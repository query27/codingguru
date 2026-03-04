import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Mistral } from '@mistralai/mistralai'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const MISTRAL_MODELS = ['codestral-latest']

export async function POST(req: Request) {
  try {
    const { sessionId, content, imageBase64, imageMimeType } = await req.json()

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    })

    if (!session)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // --- 1. Image analysis via Scout if attached ---
    let imageContext = ''
    if (imageBase64) {
      const visionResponse = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
              { type: 'text', text: `Analyze this image briefly. Focus on code, errors, or UI issues. User's message: "${content}"` }
            ]
          }
        ]
      })
      imageContext = visionResponse.choices[0].message.content?.slice(0, 800) ?? ''
    }

    // --- 2. Save user message ---
    await prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content: imageBase64 ? `📎 [Image attached]\n${content}` : content,
        model: session.model
      }
    })

    // --- 3. Smart memory: summarize older messages ---
    const allMessages = session.messages
    const recentMessages = allMessages.slice(-4)
    const olderMessages = allMessages.slice(0, -4)
    const summary =
      olderMessages.length > 0
        ? `[Earlier in this session: ${olderMessages.map(m => `${m.role}: ${m.content.slice(0, 150)}`).join(' | ').slice(0, 800)}]`
        : ''

    const history = [
      ...(summary ? [{ role: 'system' as const, content: summary }] : []),
      ...recentMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content.slice(0, 800)
      }))
    ]

    // --- 4. Build system prompt ---
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
    }`

    // --- 5. Build messages ---
    const messages = [
      ...history,
      { role: 'user', content: imageBase64 ? `📎 [Image attached]\n${content}` : content }
    ]

    // --- 6. Call AI model ---
    let assistantMessage = ''

    if (MISTRAL_MODELS.includes(session.model)) {
      // --- Mistral call for codestral-latest ---
      const mistralInputs = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const response = await mistral.beta.conversations.start({
        model: session.model,
        inputs: mistralInputs,
        instructions: systemPrompt,
        temperature: 0.7,
        maxTokens: 4096,
        tools: []
      })

      assistantMessage = response.outputs?.[0]?.content ?? ''
    } else {
      // --- Groq call ---
      const completion = await groq.chat.completions.create({
        model: session.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      })
      assistantMessage = completion.choices[0].message.content ?? ''
    }

    // --- 7. Save assistant response ---
    const saved = await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: assistantMessage,
        model: session.model
      }
    })

    // --- 8. Save vision context separately if image used ---
    if (imageContext) {
      await prisma.message.create({
        data: {
          sessionId,
          role: 'assistant',
          content: `🔍 [Vision Analysis by Llama-4-Scout]\n${imageContext}`,
          model: VISION_MODEL
        }
      })
    }

    return NextResponse.json({
      message: assistantMessage,
      model: session.model,
      messageId: saved.id,
      visionUsed: !!imageBase64,
      visionAnalysis: imageContext || null
    })
  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Something went wrong' },
      { status: 500 }
    )
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