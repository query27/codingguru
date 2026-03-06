import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Mistral } from '@mistralai/mistralai'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })

const VISION_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'
const MISTRAL_MODELS = ['mistral-large-2512', 'mistral-large-latest', 'mistral-large-2411', 'codestral-latest']
const MISTRAL_LARGE_MODELS = ['mistral-large-2512', 'mistral-large-latest', 'mistral-large-2411']

const MISTRAL_TOOLS = [
  { type: 'web_search' },
  { type: 'image_generation' },
  { type: 'code_interpreter' },
]

function extractImagesFromText(text: string): { text: string; images: string[] } {
  const images: string[] = []
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
    const isMistralLarge = MISTRAL_LARGE_MODELS.includes(session.model)

    // 1. Vision — analyze image via Maverick
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
                text: `Analyze this image briefly. Focus ONLY on code issues, errors, or UI problems relevant to the user's message: "${content}". Summarize in clear, concise text, structured if possible. Ignore unrelated content. Keep it actionable for the next AI step.`
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

    const userContent = imageBase64
      ? `📎 [Image attached]\n${content}${imageContext ? `\n\n[Image analysis: ${imageContext}]` : ''}`
      : content

    const systemPrompt = `You are CodingGuru, a senior developer and coding assistant. You are direct, concise, and friendly — like a knowledgeable dev friend, not a consultant. 
- If the user is chill, calm, or serious, mirror that.  
- If the user is hype, casual, or bro-style, mirror that with enthusiasm

Session: "${session.name}".

Rules:
- Never use excessive formatting, tables, or long intros unless specifically asked
- Get straight to the point
- Add emojis to highlight key points
- Use them to show tone (🔥 for excitement, ✅ for success, ⚠️ for warnings, 🚀 for progress, etc.)
- Keep emojis relevant and not excessive (avoid spam)
- Ask ONE clarifying question if needed, not a questionnaire
- Write code immediately when the intent is clear
- Make responses feel human, motivating, and conversational
- Remember everything the user tells you about themselves, their projects, and preferences
- Offer options / suggestions in a casual, friendly way when appropriate
- Match tone relative to the user, not fixed hype`

    // ── STREAMING RESPONSE ────────────────────────────────────
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          let fullText = ''
          let generatedImages: string[] = []

          if (isMistral) {
            // ── MISTRAL STREAMING ──────────────────────────────
            let mistralStream: any

            if (isMistralLarge && session.mistralConversationId) {
              // Continue conversation with streaming
              mistralStream = await (mistral.beta.conversations as any).appendStream({
                conversationId: session.mistralConversationId,
                conversationAppendStreamRequest: {
                  inputs: [{ role: 'user', content: userContent }],
                  tools: MISTRAL_TOOLS as any,
                } as any
              })
            } else {
            const historyContext = session.messages.length > 0
              ? `\n\nFull conversation history (user switched to you from another model, remember everything):\n${
                  session.messages.map(m => `${m.role}: ${m.content}`).join('\n')
                }`
              : ''
              // Start new conversation with streaming
              mistralStream = await (mistral.beta.conversations as any).startStream({
                model: session.model,
                inputs: [{ role: 'user', content: userContent }],
                instructions: systemPrompt + historyContext,
                temperature: 0.7,
                maxTokens: 2048,
                ...(session.model !== 'mistral-large-latest' ? { tools: MISTRAL_TOOLS as any } : {}),
              })
            }

            // Stream Mistral chunks
            for await (const event of mistralStream) {
              // Save conversation ID when we get it
              console.log('STREAM EVENT:', JSON.stringify(event).slice(0, 200))
              if (event.event === 'message.output.delta') {
                console.log('DELTA:', JSON.stringify(event.data))
              }
              if (event.type === 'conversation.response.started' || event.conversationId) {
                const convId = event.conversationId ?? event.data?.conversationId
                if (isMistralLarge && convId && !session.mistralConversationId) {
                  await prisma.session.update({
                    where: { id: sessionId },
                    data: { mistralConversationId: convId }
                  })
                }
              }

              // Text chunks
              if (event.event === 'message.output.delta') {
                const chunk = event.data?.content ?? ''
                if (typeof chunk === 'string' && chunk) {
                  fullText += chunk
                  send({ type: 'chunk', content: chunk })
                }
              }
              
              // Save conversation ID from started event
              if (event.event === 'conversation.response.started') {
                const convId = event.data?.conversationId
                if (isMistralLarge && convId && !session.mistralConversationId) {
                  await prisma.session.update({
                    where: { id: sessionId },
                    data: { mistralConversationId: convId }
                  })
                }
              }

              // Full message output (fallback for non-streaming events)
              if (event.type === 'message.output' && event.data) {
                const content = event.data.content
                if (typeof content === 'string') {
                  fullText += content
                  send({ type: 'chunk', content })
                } else if (Array.isArray(content)) {
                  for (const item of content) {
                    if (item.type === 'text' && item.text) {
                      fullText += item.text
                      send({ type: 'chunk', content: item.text })
                    }
                  }
                }
              }

              // Final response event — get conversation ID
              if (event.type === 'conversation.response.done' || event.type === 'done') {
                const outputs = event.data?.outputs ?? event.outputs ?? []
                for (const output of outputs) {
                  if (output.type === 'message.output') {
                    const c = output.content
                    if (typeof c === 'string' && !fullText) fullText = c
                    if (Array.isArray(c) && !fullText) {
                      fullText = c.filter((i: any) => i.type === 'text').map((i: any) => i.text ?? '').join('')
                    }
                  }
                }
                const convId = event.data?.conversationId ?? event.conversationId
                if (isMistralLarge && convId && !session.mistralConversationId) {
                  await prisma.session.update({
                    where: { id: sessionId },
                    data: { mistralConversationId: convId }
                  })
                }
              }
            }

            // Extract images from final text
            const extracted = extractImagesFromText(fullText)
            fullText = extracted.text
            generatedImages = extracted.images
            if (generatedImages.length > 0) {
              send({ type: 'images', images: generatedImages })
            }

          } else {
            // ── GROQ STREAMING ────────────────────────────────
            const allMessages = session.messages
            const recentMessages = allMessages.slice(-4)
            const olderMessages = allMessages.slice(0, -4)

            const summary = olderMessages.length > 0
              ? `[Earlier in this session: ${olderMessages
                  .map(m => `${m.role}: ${m.content.slice(0, 150)}`)
                  .join(' | ')
                  .slice(0, 800)}]`
              : ''

            const history = [
              ...(summary ? [{ role: 'system' as const, content: summary }] : []),
              ...recentMessages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content.slice(0, 800)
              }))
            ]

            const messages: any[] = [
              {
                role: 'system',
                content: systemPrompt + (imageContext ? `\n\n[VISION CONTEXT]\n${imageContext}\n[END VISION CONTEXT]` : '')
              },
              ...history,
              { role: 'user', content: userContent }
            ]

            const groqStream = await groq.chat.completions.create({
              model: session.model,
              messages,
              stream: true,
            })

            for await (const chunk of groqStream) {
              const delta = chunk.choices[0]?.delta?.content ?? ''
              if (delta) {
                fullText += delta
                send({ type: 'chunk', content: delta })
              }
            }
          }

          // Save complete assistant message to DB
          if (!fullText) fullText = 'Done!'
          const saved = await prisma.message.create({
            data: {
              sessionId,
              role: 'assistant',
              content: fullText,
              model: session.model
            }
          })

          // Save vision analysis
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

          // Send done signal with message ID
          send({
            type: 'done',
            messageId: saved.id,
            model: session.model,
            generatedImages: generatedImages.length > 0 ? generatedImages : null,
          })

        } catch (err: any) {
          console.error('Stream error:', err)
          send({ type: 'error', error: err?.message ?? 'Something went wrong' })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err?.message ?? 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const { sessionId, model } = await req.json()
  await prisma.session.update({
    where: { id: sessionId },
    data: { model, mistralConversationId: null }
  })
  return NextResponse.json({ success: true })
}