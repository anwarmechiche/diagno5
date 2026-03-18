import { NextRequest, NextResponse } from "next/server"
import { fetchMerchantEmails } from "@/lib/server/merchantReceiver"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const merchantId = searchParams.get("merchantId")
    const limit = Number(searchParams.get("limit") || "20")

    if (!merchantId) {
      return NextResponse.json({ ok: false, error: "merchantId manquant" }, { status: 400 })
    }

    const emails = await fetchMerchantEmails(merchantId, limit)
    return NextResponse.json({ ok: true, emails })
  } catch (e: any) {
    console.error("Fetch emails error:", e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
