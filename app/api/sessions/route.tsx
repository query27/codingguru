import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } }
    }
  })
  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const { name, model } = await req.json()
  const session = await prisma.session.create({
    data: { name, model: model ?? 'openai/gpt-oss-120b' }
  })
  return NextResponse.json(session)
}

export async function PATCH(req: Request) {
  const { sessionId, name } = await req.json()
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { name }
  })
  return NextResponse.json(session)
}

export async function DELETE(req: Request) {
  const { sessionId } = await req.json()
  await prisma.session.delete({ where: { id: sessionId } })
  return NextResponse.json({ success: true })
}