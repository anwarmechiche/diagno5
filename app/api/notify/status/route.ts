import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/server/mailer"
import { getMerchantEmailAccount } from "@/lib/server/merchantEmailAccounts"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const merchantId = String(body?.merchantId || "").trim()
    const merchantEmail = String(body?.merchantEmail || "").trim()
    const merchantName = String(body?.merchantName || "Fournisseur").trim()

    const clientEmail = String(body?.clientEmail || "").trim()
    const clientName = String(body?.clientName || "Client").trim()

    const orderGroupId = String(body?.orderGroupId || "").trim()
    const newStatus = String(body?.status || "").trim()
    const currency = String(body?.currency || "DZD").trim()
    const totalAmount = Number(body?.totalAmount || 0)

    if (!merchantId || !orderGroupId || !clientEmail) {
      return NextResponse.json({ ok: false, error: "Données manquantes" }, { status: 400 })
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

    const statusLabels: Record<string, string> = {
      pending: "En attente",
      processing: "En cours de préparation",
      delivered: "Livrée et Expédiée",
      cancelled: "Annulée"
    }

    const statusLabel = statusLabels[newStatus] || newStatus

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a; max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
        <div style="padding:24px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
          <h2 style="margin:0; color:#4f46e5;">Mise à jour de votre commande</h2>
          <p style="margin:8px 0 0 0; color:#64748b;">Référence : <strong>${orderGroupId}</strong></p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px 0;">Bonjour ${clientName},</p>
          <p style="margin:0 0 20px 0;">Le statut de votre commande chez <strong>${merchantName}</strong> a été mis à jour :</p>
          
          <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:16px; border-radius:8px; margin-bottom:24px;">
            <div style="font-size:12px; color:#1d4ed8; font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">Nouveau Statut</div>
            <div style="font-size:18px; font-weight:900; color:#1e3a8a; margin-top:4px;">${statusLabel}</div>
          </div>

          <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; background:#fff;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
              <span style="color:#64748b;">Total de la commande :</span>
              <span style="font-weight:700;">${totalAmount.toFixed(2)} ${currency}</span>
            </div>
          </div>

          <p style="margin:24px 0 0 0; font-size:14px; color:#475569;">
            Vous recevrez une nouvelle notification dès que l'étape suivante sera franchie.
          </p>
        </div>
        <div style="padding:16px; background:#f1f5f9; text-align:center; font-size:12px; color:#94a3b8;">
          Ceci est un message automatique de ${merchantName}.
        </div>
      </div>
    `

    await sendEmail({
      to: clientEmail,
      subject: `[${statusLabel}] Commande ${orderGroupId}`,
      html,
      replyTo: merchantEmail || undefined,
      fromName: merchantName,
      smtp
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("Error sending status email:", e)
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 })
  }
}
