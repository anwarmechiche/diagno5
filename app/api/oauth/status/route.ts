import { NextResponse } from "next/server"
import { getMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const merchantId = String(url.searchParams.get("merchantId") || "").trim()
    if (!merchantId) return NextResponse.json({ ok: false, error: "merchantId requis" }, { status: 400 })

    const account = await getMerchantEmailAccount(merchantId)
    if (!account) return NextResponse.json({ ok: true, connected: false })

    return NextResponse.json({
      ok: true,
      connected: true,
      provider: account.provider,
      email: account.email,
      expires_at: account.expires_at,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur status" }, { status: 500 })
  }
}
