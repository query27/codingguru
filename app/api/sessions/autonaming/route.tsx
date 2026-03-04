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
        content: 'Generate a 2-4 word chat title. ONLY output the title. No punctuation, no quotes, no explanation. Max 4 words. Examples: "Webhook Duplicate Fix", "React Hook Error", "SQL Query Help"'
      },
      {
        role: 'user',
        content: message
      }
    ],
    max_tokens: 10
  })

  const name = completion.choices[0].message.content?.trim() ?? 'New Session'
  return NextResponse.json({ name })
}