import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin"
import { sendEmail } from "@/lib/server/mailer"
import { getMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const merchantId = String(body?.merchantId || "").trim()
    const merchantEmail = String(body?.merchantEmail || "").trim()
    const merchantName = String(body?.merchantName || "Fournisseur").trim()

    const clientId = String(body?.clientId || "").trim()
    const clientName = String(body?.clientName || "Client").trim()
    const clientEmail = String(body?.clientEmail || "").trim()

    const sendClientConfirmation = body?.sendClientConfirmation === false ? false : true

    const orderGroupId = String(body?.orderGroupId || "").trim()
    const itemsCount = Number(body?.itemsCount || 0)
    const totalAmount = Number(body?.totalAmount || 0)
    const currency = String(body?.currency || "DZD").trim()

    if (!merchantId || !orderGroupId) {
      return NextResponse.json({ ok: false, error: "merchantId et orderGroupId requis" }, { status: 400 })
    }

    // Récupérer le compte email du marchand (Gmail Manuel ou OAuth)
    const emailAccount = await getMerchantEmailAccount(merchantId)
    const smtp = emailAccount?.provider === 'gmail_manual' ? {
      host: 'smtp.gmail.com',
      port: 587,
      user: emailAccount.email,
      pass: emailAccount.access_token,
      from: emailAccount.email,
      secure: false
    } : undefined

    const title = "Nouvelle commande"
    const message = `${clientName} a passé une commande (${orderGroupId}) — ${itemsCount} article(s) — ${totalAmount.toFixed(2)} ${currency}`

    const admin = getSupabaseAdmin()
    if (admin) {
      try {
        await admin.from("notifications").insert({
          merchant_id: merchantId,
          client_id: clientId || null,
          title,
          message,
          created_at: new Date().toISOString(),
          read: false,
        })
      } catch {
        // best-effort
      }
    }

    // Email merchant (offline notification)
    if (merchantEmail) {
      const html = `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a;">
          <h2 style="margin:0 0 10px 0;">Nouvelle commande</h2>
          <p style="margin:0 0 12px 0; color:#334155;">Vous avez reçu une nouvelle commande.</p>
          <div style="border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
            <div><strong>Référence:</strong> ${orderGroupId}</div>
            <div><strong>Client:</strong> ${clientName}</div>
            <div><strong>Articles:</strong> ${itemsCount}</div>
            <div><strong>Total:</strong> ${totalAmount.toFixed(2)} ${currency}</div>
          </div>
          <p style="margin:12px 0 0 0; color:#64748b; font-size:12px;">Connectez-vous au tableau de bord pour traiter la commande.</p>
        </div>
      `

      await sendEmail({
        to: merchantEmail,
        subject: `Nouvelle commande ${orderGroupId}`,
        html,
        replyTo: clientEmail || undefined,
        fromName: merchantName,
        smtp
      })
    }

    // Optional: confirmation client
    if (sendClientConfirmation && clientEmail) {
      const html = `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a;">
          <h2 style="margin:0 0 10px 0;">Commande confirmée</h2>
          <p style="margin:0 0 12px 0; color:#334155;">Votre commande a été enregistrée.</p>
          <div style="border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
            <div><strong>Référence:</strong> ${orderGroupId}</div>
            <div><strong>Fournisseur:</strong> ${merchantName}</div>
            <div><strong>Articles:</strong> ${itemsCount}</div>
            <div><strong>Total:</strong> ${totalAmount.toFixed(2)} ${currency}</div>
          </div>
          <p style="margin:12px 0 0 0; color:#64748b; font-size:12px;">Merci pour votre confiance.</p>
        </div>
      `

      await sendEmail({
        to: clientEmail,
        subject: `Confirmation commande ${orderGroupId}`,
        html,
        replyTo: merchantEmail || undefined,
        fromName: merchantName,
        smtp
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur notification" }, { status: 500 })
  }
}


