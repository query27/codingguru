import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const { message } = await req.json()

  const completion = await groq.chat.completions.create({
    model: 'groq/compound-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a chat title generator. Generate a short 4-5 word title for a chat based on the first message. Return ONLY the title, no quotes, no punctuation, no explanation.'
      },
      {
        role: 'user',
        content: message
      }
    ],
    max_tokens: 20
  })

  const name = completion.choices[0].message.content?.trim() ?? 'New Session'
  return NextResponse.json({ name })
}