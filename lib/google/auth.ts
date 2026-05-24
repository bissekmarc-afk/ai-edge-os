import { createSign } from "node:crypto"

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url")
}

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error("Google service account credentials not configured")
  }

  // dotenv stores \n as literal backslash-n — restore real newlines
  const privateKey = rawKey.replace(/\\n/g, "\n")

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64url(
    JSON.stringify({ iss: email, scope, aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now })
  )
  const unsigned = `${header}.${claim}`
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url")
  const jwt = `${unsigned}.${signature}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!data.access_token) {
    throw new Error(`Google OAuth error: ${data.error ?? "unknown"}`)
  }
  return data.access_token
}
