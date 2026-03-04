import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Mistral } from '@mistralai/mistralai'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })

const VISION_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'
const MISTRAL_MODELS = ['mistral-large-2512', 'mistral-large-latest', 'codestral-latest']

const MISTRAL_TOOLS = [
  { type: 'web_search' },
  { type: 'image_generation' },
  { type: 'code_interpreter' },
]

// Parse Mistral outputs array → extract text + images + code results
function parseMistralOutputs(outputs: any[]): { text: string; images: string[] } {
  let text = ''
  const images: string[] = []

  for (const output of outputs) {
    if (output.type === 'message.output') {
      // Handle plain string content (Codestral returns this)
      if (typeof output.content === 'string') {
        text += output.content
      }
      // Handle array content (Mistral Large returns this)
      if (Array.isArray(output.content)) {
        for (const item of output.content) {
          if (item.type === 'text') text += item.text ?? ''
        }
      }
    }
  }

  // Extract image URLs from markdown
  const urlRegex = /https?:\/\/[^\s\)]+\.(?:jpg|jpeg|png|gif|webp)[^\s\)]*/gi
  const found = text.match(urlRegex)
  if (found) {
    images.push(...found)
    text = text.replace(/\[.*?\]\(https?:\/\/[^\)]+\)/g, '').trim()
  }

  return { text: text.trim(), images }
}

export async function POST(req: Request) {
  try {
    const { sessionId, content, imageBase64, imageMimeType } = await req.json()

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const isMistral = MISTRAL_MODELS.includes(session.model)

    // 1. If image attached → run through vision model first
    let imageContext = ''
    if (imageBase64) {
      const visionResponse = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
              },
              {
                type: 'text',
                text: `Analyze this image briefly. Focus on code, errors, or UI issues. User's message: "${content}"`
              }
            ]
          }
        ]
      })
      imageContext = visionResponse.choices[0].message.content?.slice(0, 800) ?? ''
    }

    // 2. Save user message
    await prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content: imageBase64 ? `📎 [Image attached]\n${content}` : content,
        model: session.model
      }
    })

    // 3. Smart memory
    const allMessages = session.messages
    const recentMessages = allMessages.slice(-4)
    const olderMessages = allMessages.slice(0, -4)

    const summary = olderMessages.length > 0
      ? `[Earlier in this session: ${olderMessages
          .map(m => `${m.role}: ${m.content.slice(0, 150)}`)
          .join(' | ')
          .slice(0, 800)}]`
      : ''

    const systemPrompt = `You are CodingGuru, a senior developer and coding assistant. You are direct, concise, and friendly — like a knowledgeable dev friend, not a consultant.

Session: "${session.name}".

Rules:
- Never use excessive formatting, tables, or long intros unless specifically asked
- Get straight to the point
- Ask ONE clarifying question if needed, not a questionnaire
- Write code immediately when the intent is clear
- Be conversational, not formal
- You have full memory of this session only${
      imageContext
        ? `\n\n[VISION CONTEXT from image analysis]\n${imageContext}\n[END VISION CONTEXT]\nUse this context to answer the user's question about the image.`
        : ''
    }${summary ? `\n\n${summary}` : ''}`

    const userContent = imageBase64 ? `📎 [Image attached]\n${content}` : content

    let assistantMessage = ''
    let generatedImages: string[] = []

    if (isMistral) {
      // ── MISTRAL PATH ──────────────────────────────────────────
      const mistralMessages: any[] = [
        ...recentMessages.map(m => ({
          role: m.role,
          content: m.content.slice(0, 800)
        })),
        { role: 'user', content: userContent }
      ]

      const response = await mistral.beta.conversations.start({
        model: session.model,
        inputs: mistralMessages,
        instructions: systemPrompt,
        temperature: 0.7,
        maxTokens: 4096,
        ...(session.model === 'codestral-latest' ? {} : { tools: MISTRAL_TOOLS as any }),
      })
      console.log('FULL OUTPUTS:', JSON.stringify(response.outputs, null, 2))

      const parsed = await parseMistralOutputs(response.outputs ?? [], mistral)
      assistantMessage = parsed.text || 'Done!'
      generatedImages = parsed.images

    } else {
      // ── GROQ PATH ─────────────────────────────────────────────
      const history = [
        ...(summary ? [{ role: 'system' as const, content: summary }] : []),
        ...recentMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content.slice(0, 800)
        }))
      ]

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userContent }
      ]

      const completion = await groq.chat.completions.create({
        model: session.model,
        messages
      })

      assistantMessage = completion.choices[0].message.content ?? ''
    }

    // 4. Save assistant response
    const saved = await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: assistantMessage,
        model: session.model
      }
    })

    // 5. Save Scout's vision analysis if image was used
    if (imageContext) {
      await prisma.message.create({
        data: {
          sessionId,
          role: 'assistant',
          content: `🔍 [Vision Analysis]\n${imageContext}`,
          model: VISION_MODEL
        }
      })
    }

    return NextResponse.json({
      message: assistantMessage,
      model: session.model,
      messageId: saved.id,
      visionUsed: !!imageBase64,
      generatedImages: generatedImages.length > 0 ? generatedImages : null,
    })

  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err?.message ?? 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const { sessionId, model } = await req.json()
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { model }
  })
  return NextResponse.json(session)
}