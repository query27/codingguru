import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // adjust import path if needed

export async function POST(req: NextRequest) {
  const text = await req.text();
  const { sessionId } = JSON.parse(text);
  
  console.log("Cleanup requested for sessionId:", sessionId);
  
  const count = await prisma.message.count({ where: { sessionId } });
  console.log("Message count for session:", count);
  
  if (count === 0) {
    await prisma.session.delete({ where: { id: sessionId } });
    console.log("Deleted session:", sessionId);
  } else {
    console.log("Skipped — has messages:", count);
  }
  
  return NextResponse.json({ ok: true });
}