import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export async function POST(req: Request) {
  try {
    const { sessionId, content, imageBase64, imageMimeType } = await req.json()

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // 1. If image attached → run through Scout first
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
                image_url: {
                  url: `data:${imageMimeType};base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: `Analyze this image in detail. Focus on: code, errors, UI, architecture diagrams, or anything technically relevant. Be thorough — your analysis will be used by another AI model to help the user. User's message: "${content}"`
              }
            ]
          }
        ]
      })
      imageContext = visionResponse.choices[0].message.content ?? ''
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

    // 3. Build history
    const history = session.messages
      .slice(-4)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

    // 4. Build messages with system prompt
    const messages: any[] = [
      {
        role: 'system',
        content: `You are CodingGuru, a senior developer and coding assistant. You are direct, concise, and friendly — like a knowledgeable dev friend, not a consultant.

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
      },
      ...history,
      {
        role: 'user',
        content: imageBase64 ? `📎 [Image attached]\n${content}` : content
      }
    ]

    // 5. Call base model
    const completion = await groq.chat.completions.create({
      model: session.model,
      messages
    })

    const assistantMessage = completion.choices[0].message.content ?? ''

    // 6. Save assistant response
    const saved = await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: assistantMessage,
        model: session.model
      }
    })

    // 7. Save Scout's analysis as context if image was used
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