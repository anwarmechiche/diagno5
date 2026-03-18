import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { MerchantEmailAccount, getMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"

export type EmailMessage = {
  id: string
  uid: number
  from: string
  subject: string
  date: string
  text: string
  html: string
  seen: boolean
}

export async function fetchMerchantEmails(merchantId: string, limit = 20): Promise<EmailMessage[]> {
  const account = await getMerchantEmailAccount(merchantId)
  if (!account) throw new Error("Aucun compte email connecté.")

  // Pour Gmail manuel, on utilise imap.gmail.com
  const client = new ImapFlow({
    host: account.provider === "gmail_manual" ? "imap.gmail.com" : "outlook.office365.com",
    port: 993,
    secure: true,
    auth: {
      user: account.email,
      pass: account.refresh_token // App Password
    },
    logger: false
  })

  await client.connect()
  const lock = await client.getMailboxLock("INBOX")
  const emails: EmailMessage[] = []

  try {
    const list = client.fetch({ last: limit } as any, {
      envelope: true,
      source: true,
      flags: true,
      uid: true
    })

    for await (const msg of list) {
      if (!msg.source) continue
      const parsed = await simpleParser(msg.source)
      emails.push({
        id: (msg.id || msg.uid).toString(),
        uid: msg.uid,
        from: (parsed as any).from?.text || "",
        subject: (parsed as any).subject || "(Pas d'objet)",
        date: (parsed as any).date?.toISOString() || new Date().toISOString(),
        text: (parsed as any).text || "",
        html: (parsed as any).textAsHtml || "",
        seen: msg.flags?.has("\\Seen") || false
      })
    }
  } finally {
    if (lock) lock.release()
  }

  await client.logout()
  // Trier par date décroissante
  return emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
