import { NextResponse } from "next/server"
import { deleteMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const merchantId = String(body?.merchantId || "").trim()
    if (!merchantId) return NextResponse.json({ ok: false, error: "merchantId requis" }, { status: 400 })

    await deleteMerchantEmailAccount(merchantId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur disconnect" }, { status: 500 })
  }
}
