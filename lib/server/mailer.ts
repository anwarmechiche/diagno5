import nodemailer from "nodemailer"

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  replyTo?: string
  fromName?: string
  smtp?: {
    host?: string
    port?: number
    user?: string
    pass?: string
    from?: string
    secure?: boolean
  }
}

const stripHtml = (html: string) =>
  String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export async function sendEmail({ to, subject, html, replyTo, fromName, smtp }: SendEmailInput) {
  // Config globale Fallback
  const gHost = process.env.SMTP_HOST
  const gPort = Number(process.env.SMTP_PORT || "587")
  const gUser = process.env.SMTP_USER
  const gPass = process.env.SMTP_PASS
  const gSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true"
  const gFrom = process.env.SMTP_FROM

  // Utiliser le SMTP passé en param ou le global
  const host = smtp?.host || gHost
  const port = smtp?.port || (smtp?.host ? 587 : gPort)
  const user = smtp?.user || gUser
  const pass = smtp?.pass || gPass
  const from = smtp?.from || user || gFrom
  const secure = smtp?.secure !== undefined ? smtp.secure : (smtp?.host ? false : gSecure)

  if (!host || !user || !pass || !from) {
    const missing = [
      !host ? 'SMTP_HOST' : null,
      !user ? 'SMTP_USER' : null,
      !pass ? 'SMTP_PASS' : null,
      !from ? 'SMTP_FROM' : null,
    ].filter(Boolean)

    throw new Error(
      `SMTP non configuré. Variables manquantes: ${missing.join(', ')}. ` +
        `Renseigne-les dans .env.local ou configure ton Gmail dans les Paramètres.`
    )
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  const text = stripHtml(html)

  return transporter.sendMail({
    from: fromName ? `${fromName} <${from}>` : from,
    to,
    subject,
    text,
    html,
    replyTo: replyTo || undefined,
  })
}



