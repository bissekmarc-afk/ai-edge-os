import { NextResponse } from "next/server"

export async function GET() {
  const peek = (v: string | undefined) =>
    v ? `${v.slice(0, 5)}… (${v.length} chars)` : "MISSING"

  return NextResponse.json({
    ok: true,
    env: {
      SUPABASE_URL:                  peek(process.env.SUPABASE_URL),
      SUPABASE_ANON_KEY:             peek(process.env.SUPABASE_ANON_KEY),
      NEXT_PUBLIC_SUPABASE_URL:      peek(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: peek(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      TODOIST_API_TOKEN:             peek(process.env.TODOIST_API_TOKEN),
      GOOGLE_SHEETS_SPREADSHEET_ID:  peek(process.env.GOOGLE_SHEETS_SPREADSHEET_ID),
      GOOGLE_SERVICE_ACCOUNT_EMAIL:  peek(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: peek(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
      ANTHROPIC_API_KEY:                  peek(process.env.ANTHROPIC_API_KEY),
      NODE_ENV: process.env.NODE_ENV,
    },
  })
}
