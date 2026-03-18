import { NextResponse } from "next/server"
import { createSignedState } from "@/app/api/oauth/state"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const merchantId = String(url.searchParams.get("merchantId") || "").trim()

    if (!merchantId) {
      return NextResponse.json({ ok: false, error: "merchantId requis" }, { status: 400 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = process.env.GOOGLE_REDIRECT_URL

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { ok: false, error: "GOOGLE_CLIENT_ID / GOOGLE_REDIRECT_URL manquants" },
        { status: 500 }
      )
    }

    const state = createSignedState({ merchantId, provider: "google" })

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("scope", [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "))
    authUrl.searchParams.set("state", state)

    return NextResponse.redirect(authUrl.toString())
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur OAuth start" }, { status: 500 })
  }
}
