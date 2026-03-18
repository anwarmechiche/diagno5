import { NextRequest, NextResponse } from "next/server"
import { upsertMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"

export async function POST(req: NextRequest) {
  try {
    const { merchantId, email, password } = await req.json()
    
    if (!merchantId || !email || !password) {
      return NextResponse.json({ ok: false, error: "Données manquantes" }, { status: 400 })
    }

    // On stocke le App Password dans accessToken et refreshToken pour simplifier
    await upsertMerchantEmailAccount({
      merchantId,
      provider: "gmail_manual",
      email: email.trim(),
      accessToken: password.trim().replace(/\s/g, ""),
      refreshToken: password.trim().replace(/\s/g, ""),
      expiresAt: null
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("Manual Gmail error:", e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
