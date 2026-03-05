import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { message } = await req.json();

  const completion = await groq.chat.completions.create({
    model: 'groq/compound-mini',
    messages: [
      {
        role: 'system',
        content: `
          Generate a 2-4 word chat title. Follow these RULES:
          1. ONLY output the title. No punctuation, quotes, or explanation.
          2. Max 4 words. If you can't summarize in 4 words, use fewer.
          3. Be specific. Examples:
             - "Fix React useEffect loop" (good)
             - "Debugging" (bad, too vague)
             - "Next.js API route error" (good)
             - "Help" (bad, useless)
        `.trim()
      },
      {
        role: 'user',
        content: message
      }
    ],
    max_tokens: 10,
    temperature: 0.3 // 🔥 Lower = more deterministic output
  });

  // 🔥 SAFETY NET: Force truncate to 20 chars + remove bad chars
  let name = completion.choices[0].message.content?.trim() ?? 'New Chat';
  name = name
    .replace(/[^\w\s-]/g, '') // Remove punctuation
    .split(' ')
    .slice(0, 4) // Enforce 4-word max
    .join(' ')
    .substring(0, 20); // Enforce 20-char max

  return NextResponse.json({ name });
}