import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/server/mailer"
import { sendMerchantEmail } from "@/lib/server/merchantSender"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const to = String(body?.to || "").trim()
    const subject = String(body?.subject || "").trim()
    const html = String(body?.html || "")
    const replyTo = body?.replyTo ? String(body.replyTo).trim() : undefined
    const fromName = body?.fromName ? String(body.fromName).trim() : undefined

    const merchantId = body?.merchantId ? String(body.merchantId).trim() : undefined
    const sender = body?.sender ? String(body.sender).trim() : "platform"

    if (!to || !subject || !html) {
      return NextResponse.json({ ok: false, error: "Champs requis: to, subject, html" }, { status: 400 })
    }

    if (sender === "merchant" && merchantId) {
      await sendMerchantEmail({ merchantId, to, subject, html, replyTo })
    } else {
      await sendEmail({ to, subject, html, replyTo, fromName })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur envoi email" }, { status: 500 })
  }
}
