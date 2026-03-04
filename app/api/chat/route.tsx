import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

export async function POST(req: Request) {
  try {
    const { sessionId, content } = await req.json()

    // 1. Load session + full history
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // 2. Save user message
    await prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content,
        model: session.model
      }
    })

    // 3. Build full history for model
    const history = session.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

    // 4. Call Groq with full session history
    const completion = await groq.chat.completions.create({
      model: session.model,
      messages: [
        {
          role: 'system',
          content: `You are CodingGuru, an expert coding assistant. Current session: "${session.name}". You have full memory of this session only.`
        },
        ...history,
        { role: 'user', content }
      ]
    })

    const assistantMessage = completion.choices[0].message.content ?? ''

    // 5. Save assistant response
    const saved = await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: assistantMessage,
        model: session.model
      }
    })

    return NextResponse.json({
      message: assistantMessage,
      model: session.model,
      messageId: saved.id
    })

  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Something went wrong' },
      { status: 500 }
    )
  }
}

// PATCH - switch model mid chat (memory stays intact)
export async function PATCH(req: Request) {
  const { sessionId, model } = await req.json()

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { model }
  })

  return NextResponse.json(session)
}