import { NextResponse } from "next/server"
import { createSignedState } from "@/app/api/oauth/state"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const merchantId = String(url.searchParams.get("merchantId") || "").trim()

    if (!merchantId) {
      return NextResponse.json({ ok: false, error: "merchantId requis" }, { status: 400 })
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const redirectUri = process.env.MICROSOFT_REDIRECT_URL

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { ok: false, error: "MICROSOFT_CLIENT_ID / MICROSOFT_REDIRECT_URL manquants" },
        { status: 500 }
      )
    }

    const state = createSignedState({ merchantId, provider: "microsoft" })

    const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("response_mode", "query")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("scope", [
      "openid",
      "email",
      "profile",
      "offline_access",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/User.Read",
    ].join(" "))
    authUrl.searchParams.set("state", state)

    return NextResponse.redirect(authUrl.toString())
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur OAuth start" }, { status: 500 })
  }
}
