import { NextResponse } from "next/server"

export async function GET() {
  const required = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
    process.env.SMTP_PASS,
    process.env.SMTP_FROM,
  ]

  const configured = required.every((v) => Boolean(String(v || "").trim()))

  return NextResponse.json({ ok: true, configured })
}
