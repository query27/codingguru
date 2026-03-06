import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  // No messages included — loaded lazily per session click
  const sessions = await prisma.session.findMany({
    orderBy: [
      { pinned: 'desc' },
      { createdAt: 'desc' }
    ]
  })
  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const { name, model } = await req.json()
  const session = await prisma.session.create({
    data: { name, model: model ?? 'mistral-large-latest' }
  })
  return NextResponse.json(session)
}

export async function PATCH(req: Request) {
  const { sessionId, name, pinned } = await req.json()
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: {
      ...(name !== undefined && { name }),
      ...(pinned !== undefined && { pinned }),
    }
  })
  return NextResponse.json(session)
}

export async function DELETE(req: Request) {
  const { sessionId } = await req.json()
  await prisma.session.delete({ where: { id: sessionId } })
  return NextResponse.json({ success: true })
}