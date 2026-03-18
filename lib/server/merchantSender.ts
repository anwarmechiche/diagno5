import { MerchantEmailAccount, getMerchantEmailAccount, upsertMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"
import nodemailer from "nodemailer"

type SendMerchantEmailInput = {
  merchantId: string
  to: string
  subject: string
  html: string
  replyTo?: string
}

const base64UrlEncode = (input: string) =>
  Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

const buildRfc822 = (params: { from: string; to: string; subject: string; replyTo?: string; html: string }) => {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    params.replyTo ? `Reply-To: ${params.replyTo}` : "",
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    "",
    params.html,
  ].filter(Boolean)

  return lines.join("\r\n")
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET manquants")

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error_description || json?.error || "Erreur refresh token Google")

  const accessToken = String(json?.access_token || "")
  const expiresIn = Number(json?.expires_in || 0)
  if (!accessToken) throw new Error("Google: access_token manquant")

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
  return { accessToken, expiresAt }
}

async function refreshMicrosoftAccessToken(refreshToken: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET manquants")

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access https://graph.microsoft.com/Mail.Send",
  })

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error_description || json?.error || "Erreur refresh token Microsoft")

  const accessToken = String(json?.access_token || "")
  const expiresIn = Number(json?.expires_in || 0)
  if (!accessToken) throw new Error("Microsoft: access_token manquant")

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
  return { accessToken, expiresAt }
}

async function ensureFreshToken(account: MerchantEmailAccount): Promise<MerchantEmailAccount> {
  const now = Date.now()
  const exp = account.expires_at ? new Date(account.expires_at).getTime() : 0

  // Refresh if expiring in <= 2 minutes, or missing.
  const shouldRefresh = !exp || exp - now <= 2 * 60 * 1000
  if (!shouldRefresh || account.provider === ("gmail_manual" as any)) return account

  if (account.provider === "google") {
    const refreshed = await refreshGoogleAccessToken(account.refresh_token)
    await upsertMerchantEmailAccount({
      merchantId: account.merchant_id,
      provider: "google",
      email: account.email,
      accessToken: refreshed.accessToken,
      refreshToken: account.refresh_token,
      expiresAt: refreshed.expiresAt,
      scope: account.scope,
      tokenType: account.token_type,
    })
    return { ...account, access_token: refreshed.accessToken, expires_at: refreshed.expiresAt }
  }

  const refreshed = await refreshMicrosoftAccessToken(account.refresh_token)
  await upsertMerchantEmailAccount({
    merchantId: account.merchant_id,
    provider: "microsoft",
    email: account.email,
    accessToken: refreshed.accessToken,
    refreshToken: account.refresh_token,
    expiresAt: refreshed.expiresAt,
    scope: account.scope,
    tokenType: account.token_type,
  })
  return { ...account, access_token: refreshed.accessToken, expires_at: refreshed.expiresAt }
}

async function sendViaGmailApi(account: MerchantEmailAccount, input: SendMerchantEmailInput) {
  const rfc822 = buildRfc822({
    from: account.email,
    to: input.to,
    subject: input.subject,
    replyTo: input.replyTo,
    html: input.html,
  })

  const raw = base64UrlEncode(rfc822)

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error?.message || "Erreur envoi Gmail API")
}

async function sendViaMicrosoftGraph(account: MerchantEmailAccount, input: SendMerchantEmailInput) {
  const body: any = {
    message: {
      subject: input.subject,
      body: { contentType: "HTML", content: input.html },
      toRecipients: [{ emailAddress: { address: input.to } }],
    },
    saveToSentItems: "true",
  }

  if (input.replyTo) {
    body.message.replyTo = [{ emailAddress: { address: input.replyTo } }]
  }

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(txt || "Erreur envoi Microsoft Graph")
  }
}

async function sendViaNodemailer(account: MerchantEmailAccount, input: SendMerchantEmailInput) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: account.email,
      pass: account.refresh_token // Le App Password est stocké ici
    }
  })

  await transporter.sendMail({
    from: account.email,
    to: input.to,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo
  })
}

export async function sendMerchantEmail(input: SendMerchantEmailInput) {
  const account = await getMerchantEmailAccount(input.merchantId)
  if (!account) throw new Error("Aucun expéditeur connecté. Connecte Gmail/Outlook dans Paramètres fournisseur.")

  const fresh = await ensureFreshToken(account)

  if (fresh.provider === ("gmail_manual" as any)) {
    await sendViaNodemailer(fresh, input)
    return
  }

  if (fresh.provider === "google") {
    await sendViaGmailApi(fresh, input)
    return
  }

  await sendViaMicrosoftGraph(fresh, input)
}
