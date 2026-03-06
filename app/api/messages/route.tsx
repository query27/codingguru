import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const PAGE_SIZE = 20

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const cursor = searchParams.get('cursor') // message id to load before (for older messages)

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // Get total count
  const total = await prisma.message.count({ where: { sessionId } })

  if (cursor) {
    // Load older messages — get messages before the cursor message
    const cursorMsg = await prisma.message.findUnique({ where: { id: cursor } })
    if (!cursorMsg) return NextResponse.json({ error: 'cursor not found' }, { status: 404 })

    const messages = await prisma.message.findMany({
      where: {
        sessionId,
        createdAt: { lt: cursorMsg.createdAt }
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE
    })

    // Return in ascending order
    const sorted = messages.reverse()
    const hasMore = sorted.length === PAGE_SIZE

    return NextResponse.json({ messages: sorted, hasMore, total })
  } else {
    // Initial load — get last PAGE_SIZE messages
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE
    })

    const sorted = messages.reverse()
    const hasMore = total > PAGE_SIZE

    return NextResponse.json({ messages: sorted, hasMore, total })
  }
}