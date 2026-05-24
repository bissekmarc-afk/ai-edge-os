import { NextResponse } from "next/server"
import { getAllMemories } from "@/lib/queries/memory"

export async function GET() {
  const memories = await getAllMemories(50)
  return NextResponse.json({ memories })
}
