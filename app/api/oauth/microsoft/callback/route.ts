import { NextResponse } from "next/server"
import { verifySignedState } from "@/app/api/oauth/state"
import { upsertMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const code = String(url.searchParams.get("code") || "").trim()
    const stateRaw = String(url.searchParams.get("state") || "").trim()

    if (!code || !stateRaw) {
      return NextResponse.json({ ok: false, error: "code/state manquants" }, { status: 400 })
    }

    const state = verifySignedState(stateRaw)
    if (state.provider !== "microsoft") {
      return NextResponse.json({ ok: false, error: "provider invalide" }, { status: 400 })
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const redirectUri = process.env.MICROSOFT_REDIRECT_URL

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { ok: false, error: "MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET/MICROSOFT_REDIRECT_URL manquants" },
        { status: 500 }
      )
    }

    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read",
      }),
    })

    const tokenJson = await tokenRes.json().catch(() => null)
    if (!tokenRes.ok) {
      return NextResponse.json(
        { ok: false, error: tokenJson?.error_description || tokenJson?.error || "Erreur token Microsoft" },
        { status: 400 }
      )
    }

    const accessToken = String(tokenJson?.access_token || "")
    const refreshToken = String(tokenJson?.refresh_token || "")
    const expiresIn = Number(tokenJson?.expires_in || 0)
    const scope = tokenJson?.scope ? String(tokenJson.scope) : null
    const tokenType = tokenJson?.token_type ? String(tokenJson.token_type) : null

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ ok: false, error: "Tokens manquants" }, { status: 400 })
    }

    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const meJson = await meRes.json().catch(() => null)

    const email = String(meJson?.mail || meJson?.userPrincipalName || "").trim()
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email Microsoft introuvable" }, { status: 400 })
    }

    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

    await upsertMerchantEmailAccount({
      merchantId: state.merchantId,
      provider: "microsoft",
      email,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      tokenType,
    })

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
    const redirect = appUrl ? `${appUrl}/fournisseur/dashboard` : "/fournisseur/dashboard"
    return NextResponse.redirect(redirect)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur OAuth Microsoft callback" }, { status: 500 })
  }
}
