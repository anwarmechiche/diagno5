'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase' 
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { LayoutDashboard, Users, MapPin, Phone, Mail, FileText } from 'lucide-react'
import { motion } from 'framer-motion'


// Type local étendu pour inclure les données du client
interface Invoice {
  id: string
  invoice_number: string
  client_id: number  // CHANGÉ: string → number (pour bigint)
  merchant_id: number
  date: string
  due_date: string
  items: any[]
  total_ht: number
  tva_rate: number
  total_ttc: number
  status: 'draft' | 'pending' | 'paid' | 'cancelled'
  payment_method?: string
  payment_date?: string
  notes?: string
  created_at: string
  updated_at: string
  // Jointure manuelle
  clients?: {
    name: string
    phone: string
    email: string
    city?: string
    address?: string
  }
}

interface InvoicesListPageProps {
  merchantId: string
  refreshKey?: number
  hideHeader?: boolean
}

export default function InvoicesListPage({ merchantId, refreshKey, hideHeader }: InvoicesListPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [emailSending, setEmailSending] = useState(false)
  
  const [viewInvoiceModalOpen, setViewInvoiceModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  useEffect(() => {
    if (merchantId) {
      fetchData()
    }
  }, [merchantId, refreshKey])

  useEffect(() => {
    if (!merchantId) return
    ;(async () => {
      try {
        const { data } = await supabase.from('merchants').select('*').eq('id', merchantId).single()
        if (data) setCompanyInfo(data)
      } catch {}
    })()
  }, [merchantId])

  const normalizeOrderRef = (raw: string) => {
    const value = String(raw || '').trim()
    if (!value) return 'CMD-0000'
    if (/^cmd-\d{4}$/i.test(value) || /^CMD-\d{4}$/i.test(value)) return value.toUpperCase()
    const digits = value.replace(/\D/g, '')
    if (!digits) return 'CMD-0000'
    return `CMD-${digits.slice(-4).padStart(4, '0')}`
  }

  const openInvoicePrintWindow = (invoice: Invoice) => {
    const w = window.open('', '_blank')
    if (!w) return

    const companyName = companyInfo?.company_name || companyInfo?.name || 'Entreprise'
    const companyEmail = companyInfo?.company_email || companyInfo?.email || ''
    const companyPhone = companyInfo?.company_phone || companyInfo?.phone || ''
    const companyAddress = companyInfo?.company_address || companyInfo?.address || ''
    const companyCity = companyInfo?.company_city || companyInfo?.city || ''

    const clientName = invoice.clients?.name || 'Client'
    const clientCity = invoice.clients?.city || ''
    const clientPhone = invoice.clients?.phone || ''
    const clientEmail = invoice.clients?.email || ''
    const clientAddress = invoice.clients?.address || ''

    const items = Array.isArray(invoice?.items) ? invoice.items : []
    const totalHT = Number((invoice as any)?.total_ht ?? 0)
    const tvaRate = Number((invoice as any)?.tva_rate ?? 0)
    const tvaAmount = totalHT * (tvaRate / 100)
    const totalTTC = Number((invoice as any)?.total_ttc ?? totalHT + tvaAmount)

    const fiscalLine = [
      companyInfo?.rc ? `RC: ${companyInfo.rc}` : '',
      companyInfo?.nif ? `NIF: ${companyInfo.nif}` : '',
      companyInfo?.nis ? `NIS: ${companyInfo.nis}` : '',
      companyInfo?.ai ? `AI: ${companyInfo.ai}` : '',
    ].filter(Boolean).join(' • ')
    
    // Client fiscal info from notes if present
    const notesStr = String(invoice?.notes || '')
    const clientRC = notesStr.match(/RC:\s*([^\s•]+)/i)?.[1] || ''
    const clientNIF = notesStr.match(/NIF:\s*([^\s•]+)/i)?.[1] || ''
    const clientAI = notesStr.match(/AI:\s*([^\s•]+)/i)?.[1] || ''

    const orderRef = normalizeOrderRef(String((invoice as any)?.order_group_id || ''))

    const htmlRows = items.map((item: any, idx: number) => {
      const qty = Number(item.quantity || 0)
      const price = Number(item.price || 0)
      const line = qty * price
      return `
        <tr>
          <td class="col-idx">${idx + 1}</td>
          <td class="col-desc">
            <div class="item-name">${String(item.name || '').replaceAll('<', '&lt;')}</div>
          </td>
          <td class="col-qty">${qty}</td>
          <td class="col-price">${price.toFixed(2)}</td>
          <td class="col-total">${line.toFixed(2)}</td>
        </tr>
      `
    }).join('')

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Facture ${String(invoice?.invoice_number || '').replaceAll('<', '&lt;')}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            
            :root { 
              --primary: #714B67; 
              --primary-light: #f5f0f3;
              --text-main: #0f172a; 
              --text-muted: #64748b; 
              --border: #e2e8f0; 
              --bg: #ffffff; 
            }
            
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            
            body { 
              margin: 0; 
              padding: 0;
              font-family: 'Inter', -apple-system, sans-serif; 
              color: var(--text-main); 
              background: #f8fafc;
              line-height: 1.5;
            }

            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 20px auto;
              background: white;
              padding: 15mm;
              box-shadow: 0 0 20px rgba(0,0,0,0.05);
              position: relative;
            }

            @media print {
              body { background: white; padding: 0; }
              .page { margin: 0; box-shadow: none; border: none; width: 100%; height: auto; }
              .no-print { display: none; }
            }

            /* Toolbar */
            .toolbar {
              max-width: 210mm;
              margin: 10px auto;
              display: flex;
              justify-content: flex-end;
              gap: 10px;
            }

            .btn {
              padding: 10px 20px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 14px;
              cursor: pointer;
              border: none;
              transition: all 0.2s;
            }

            .btn-print { background: var(--primary); color: white; }
            .btn-print:hover { background: #5a3a52; }

            /* Header Design */
            .header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              border-bottom: 2px solid var(--primary);
              padding-bottom: 20px;
            }

            .company-info h1 {
              font-size: 24px;
              font-weight: 800;
              margin: 0 0 10px 0;
              color: var(--primary);
              text-transform: uppercase;
              letter-spacing: -0.02em;
            }

            .company-details {
              font-size: 12px;
              color: var(--text-muted);
              max-width: 300px;
            }

            .doc-type {
              text-align: right;
            }

            .doc-type h2 {
              font-size: 36px;
              font-weight: 900;
              margin: 0;
              color: var(--primary);
              opacity: 0.15;
              text-transform: uppercase;
              line-height: 1;
            }

            .doc-meta {
              margin-top: 10px;
              font-weight: 700;
              font-size: 16px;
            }

            .doc-meta .label { color: var(--text-muted); font-size: 11px; text-transform: uppercase; display: block; }

            /* Fiscal Grid */
            .fiscal-bar {
              background: var(--primary-light);
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              padding: 12px 20px;
              border-radius: 8px;
              margin-bottom: 30px;
              font-size: 11px;
            }

            .fiscal-item .label { color: var(--primary); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 2px; opacity: 0.7; }
            .fiscal-item .value { font-weight: 600; color: var(--text-main); }

            /* Parties Grid */
            .parties {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 40px;
              margin-bottom: 40px;
            }

            .party-header {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: var(--text-muted);
              margin-bottom: 12px;
              padding-bottom: 6px;
              border-bottom: 1px solid var(--border);
            }

            .party-name { font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 8px; }
            .party-address { font-size: 12px; color: var(--text-muted); line-height: 1.6; }

            .dates-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }

            /* Table Style */
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { 
              background: #f8fafc;
              text-align: left; 
              padding: 12px 10px; 
              font-size: 10px; 
              font-weight: 800; 
              text-transform: uppercase; 
              color: var(--text-muted); 
              border-bottom: 2px solid var(--text-main);
            }
            td { padding: 15px 10px; border-bottom: 1px solid var(--border); font-size: 13px; }

            .col-idx { width: 40px; color: var(--text-muted); font-size: 11px; }
            .col-desc { font-weight: 600; color: var(--text-main); }
            .col-qty, .col-price, .col-total { text-align: right; width: 100px; font-variant-numeric: tabular-nums; }
            .col-total { font-weight: 700; }

            /* Totals Section */
            .bottom-section {
              display: grid;
              grid-template-columns: 1.5fr 1fr;
              gap: 40px;
            }

            .notes-section {
              font-size: 12px;
              color: var(--text-muted);
            }

            .notes-box {
              margin-top: 10px;
              padding: 15px;
              background: #f8fafc;
              border-radius: 8px;
              min-height: 80px;
              border: 1px dashed var(--border);
            }

            .totals-box {
              background: var(--text-main);
              color: white;
              padding: 25px;
              border-radius: 12px;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 13px;
              opacity: 0.8;
            }

            .total-row.grand {
              border-top: 1px solid rgba(255,255,255,0.1);
              margin-top: 15px;
              padding-top: 15px;
              opacity: 1;
              font-size: 20px;
              font-weight: 800;
            }

            .total-row.grand .label { color: rgba(255,255,255,0.6); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; align-self: center; }

            /* Footer */
            .footer {
              position: absolute;
              bottom: 15mm;
              left: 15mm;
              right: 15mm;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding-top: 20px;
              border-top: 1px solid var(--border);
            }

            .signature-box {
              width: 200px;
              height: 100px;
              border: 1px solid var(--border);
              border-radius: 8px;
              position: relative;
              padding: 10px;
              text-align: center;
              font-size: 11px;
              color: var(--text-muted);
              font-weight: 700;
              text-transform: uppercase;
            }

            .footer-legal {
              font-size: 10px;
              color: var(--text-muted);
              max-width: 400px;
            }
          </style>
        </head>
        <body>
          <div class="toolbar no-print">
            <button class="btn btn-print" onclick="window.print()">Imprimer la Facture</button>
          </div>

          <div class="page">
            <div class="header">
              <div class="company-info">
                <h1>${String(companyName).replaceAll('<', '&lt;')}</h1>
                <div class="company-details">
                  ${[companyAddress, companyCity].filter(Boolean).map((v: string) => String(v).replaceAll('<', '&lt;')).join(', ')}<br/>
                  Tél: ${String(companyPhone).replaceAll('<', '&lt;')} • Email: ${String(companyEmail).replaceAll('<', '&lt;')}
                </div>
              </div>
              <div class="doc-type">
                <h2>Facture</h2>
                <div class="doc-meta">
                  <span class="label">Numéro de pièce</span>
                  ${String(invoice?.invoice_number || '').replaceAll('<', '&lt;')}
                </div>
              </div>
            </div>

            <div class="fiscal-bar">
              <div class="fiscal-item"><span class="label">RC</span><span class="value">${companyInfo?.rc || '-'}</span></div>
              <div class="fiscal-item"><span class="label">NIF</span><span class="value">${companyInfo?.nif || '-'}</span></div>
              <div class="fiscal-item"><span class="label">AI</span><span class="value">${companyInfo?.ai || '-'}</span></div>
              <div class="fiscal-item"><span class="label">NIS</span><span class="value">${companyInfo?.nis || '-'}</span></div>
            </div>

            <div class="parties">
              <div class="client-card">
                <div class="party-header">Client / Facturé à</div>
                <div class="party-name">${String(clientName).replaceAll('<', '&lt;')}</div>
                <div class="party-address">
                  ${[clientAddress, clientCity].filter(Boolean).map((v: string) => String(v).replaceAll('<', '&lt;')).join('<br/>')}
                  <div style="margin-top:5px;">
                    Tél: ${String(clientPhone).replaceAll('<', '&lt;')}<br/>
                    Email: ${String(clientEmail).replaceAll('<', '&lt;')}.
                  </div>
                  ${(clientRC || clientNIF || clientAI) ? `
                    <div style="margin-top:10px; font-size:10px; color:var(--text-main); font-weight:600;">
                      ${clientRC ? `RC: ${clientRC} ` : ''} 
                      ${clientNIF ? `• NIF: ${clientNIF} ` : ''} 
                      ${clientAI ? `• AI: ${clientAI}` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
              <div class="dates-section">
                <div class="party-header">Détails temporels</div>
                <div class="dates-grid">
                  <div>
                    <span class="label" style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Date d'émission</span>
                    <div style="font-weight:700;">${String((invoice as any)?.date || '').replaceAll('<', '&lt;')}</div>
                  </div>
                  <div>
                    <span class="label" style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Date d'échéance</span>
                    <div style="font-weight:700;">${String((invoice as any)?.due_date || '').replaceAll('<', '&lt;')}</div>
                  </div>
                </div>
                <div style="margin-top:20px;">
                  <span class="label" style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Référence Commande</span>
                  <div style="font-weight:700; color:var(--primary); font-family:monospace;">${String(orderRef).replaceAll('<', '&lt;')}</div>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="col-idx">#</th>
                  <th class="col-desc">Désignation</th>
                  <th class="col-qty">Quantité</th>
                  <th class="col-price">P.U (DA)</th>
                  <th class="col-total">Total (DA)</th>
                </tr>
              </thead>
              <tbody>
                ${htmlRows || `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:40px;">Aucun article dans cette facture</td></tr>`}
              </tbody>
            </table>

            <div class="bottom-section">
              <div class="notes-section">
                <div class="party-header">Observations / Notes</div>
                <div class="notes-box">
                  ${String(invoice.notes || 'Aucune note particulière.').replaceAll('<', '&lt;')}
                </div>
                <div style="margin-top:20px; font-size:11px;">
                  Arrêtée la présente facture à la somme de :<br/>
                  <strong style="text-transform:uppercase; color:var(--text-main);">${totalTTC.toFixed(2)} Dinars Algériens</strong>
                </div>
              </div>
              <div class="totals-box">
                <div class="total-row"><span>Total Hors Taxe</span><span>${totalHT.toFixed(2)}</span></div>
                <div class="total-row"><span>TVA (${tvaRate.toFixed(0)}%)</span><span>${tvaAmount.toFixed(2)}</span></div>
                <div class="total-row grand">
                  <span class="label">Net à Payer</span>
                  <span>${totalTTC.toFixed(2)} <small style="font-size:14px;">DA</small></span>
                </div>
                ${tvaRate === 0 ? `<div style="margin-top:15px; font-size:11px; opacity:0.6; font-style:italic;">Exonéré de TVA selon la législation en vigueur.</div>` : ''}
              </div>
            </div>

            <div class="footer">
              <div class="footer-legal">
                Facture générée numériquement.<br/>
                ${companyName} - ${companyCity}
              </div>
              <div class="signature-box">
                Signature & Cachet
              </div>
            </div>
          </div>
        </body>
      </html>
    `)

    w.document.close()
  }

  const escapeHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const getApiBaseUrl = () => {
    if (typeof window === 'undefined') return ''
    const stored = String(window.localStorage.getItem('app_api_base_url') || '').trim()
    const env = String((process as any)?.env?.NEXT_PUBLIC_APP_URL || '').trim()
    const base = stored || env
    return base ? base.replace(/\/$/, '') : ''
  }

  const sendInvoiceByEmail = async (invoice: Invoice) => {
    const to = String(invoice?.clients?.email || '').trim()
    if (!to) {
      alert('Email du laboratoire manquant. Ajoutez-le dans la fiche laboratoire.')
      return
    }

    const companyName = String(companyInfo?.company_name || companyInfo?.name || 'Fournisseur').trim()
    const replyTo = String(companyInfo?.company_email || companyInfo?.email || '').trim() || undefined

    const items = Array.isArray(invoice?.items) ? invoice.items : []
    const totalHT = Number((invoice as any)?.total_ht ?? 0)
    const tvaRate = Number((invoice as any)?.tva_rate ?? 0)
    const tvaAmount = totalHT * (tvaRate / 100)
    const totalTTC = Number((invoice as any)?.total_ttc ?? totalHT + tvaAmount)

    const rows = items
      .map((item: any) => {
        const qty = Number(item?.quantity || 0)
        const price = Number(item?.price || 0)
        const line = qty * price
        return `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0;">${escapeHtml(item?.name || '')}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${qty}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${price.toFixed(2)} DA</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700;">${line.toFixed(2)} DA</td>
          </tr>
        `
      })
      .join('')

    const clientName = String(invoice?.clients?.name || 'Client')

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#0f172a;">
        <div style="max-width:760px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <div style="padding:18px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <div>
                <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:800;">Facture</div>
                <div style="margin-top:6px;font-size:20px;font-weight:900;">${escapeHtml(invoice?.invoice_number || '')}</div>
                <div style="margin-top:6px;color:#475569;font-size:12px;">Destinataire: ${escapeHtml(clientName)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:900;">${escapeHtml(companyName)}</div>
                ${replyTo ? `<div style="margin-top:6px;color:#475569;font-size:12px;">${escapeHtml(replyTo)}</div>` : ''}
              </div>
            </div>
          </div>

          <div style="padding:18px;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">Description</th>
                  <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">Qté</th>
                  <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">PU</th>
                  <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="4" style="padding:10px 12px;color:#64748b;">Aucune ligne</td></tr>`}
              </tbody>
            </table>

            <div style="margin-top:14px;display:flex;justify-content:flex-end;">
              <div style="width:100%;max-width:320px;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#ffffff;">
                <div style="display:flex;justify-content:space-between;color:#475569;font-weight:800;font-size:12px;"><span>Total HT</span><span>${totalHT.toFixed(2)} DA</span></div>
                <div style="margin-top:6px;display:flex;justify-content:space-between;color:#475569;font-weight:800;font-size:12px;"><span>TVA (${tvaRate.toFixed(0)}%)</span><span>${tvaAmount.toFixed(2)} DA</span></div>
                <div style="margin-top:8px;padding-top:10px;border-top:1px dashed #e2e8f0;display:flex;justify-content:space-between;font-weight:900;"><span>Total TTC</span><span style="color:#4f46e5;">${totalTTC.toFixed(2)} DA</span></div>
                ${tvaRate === 0 ? `<div style="margin-top:10px;font-size:12px;color:#64748b;font-weight:800;">Non assujetti à la TVA</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    try {
      setEmailSending(true)
      const base = getApiBaseUrl()
      const url = base ? `${base}/api/mail/send` : '/api/mail/send'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: `Facture ${String(invoice?.invoice_number || '').trim()}`,
          html,
          replyTo,
          fromName: companyName || undefined,
          merchantId: String(merchantId),
          sender: 'merchant',
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Envoi email échoué')
      alert('✅ Facture envoyée par email')
    } catch (e: any) {
      console.error('Send invoice email failed', e)
      if (String(e?.message || '').toLowerCase().includes('failed to fetch')) {
        const base = getApiBaseUrl()
        alert(
          `❌ Serveur email/API indisponible.\n\n` +
            `- Lance le serveur (npm run dev) si tu es en local.\n` +
            `- Ou configure l’URL serveur dans Paramètres → Emails & notifications.\n\n` +
            `URL: ${base || '(relative /api)'}\n`
        )
      } else {
        alert(e?.message || '❌ Impossible d’envoyer la facture par email')
      }
    } finally {
      setEmailSending(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      // 1. Récupérer les factures
      let invData: any[] | null = null
      let invError: any = null

      const merchantIdNumber = Number(String(merchantId).trim())
      const merchantIdBigint = Number.isFinite(merchantIdNumber) ? merchantIdNumber : null
      if (merchantIdBigint === null) throw new Error('merchantId invalide (doit être numérique)')

      const primary = await supabase
        .from('invoices')
        .select('*')
        .eq('merchant_id', merchantIdBigint)
        .order('created_at', { ascending: false })

      if (!primary.error) {
        invData = primary.data || []
      } else {
        invError = primary.error
      }

      if (invError) throw invError

      // 2. Récupérer les clients
      const { data: cliData, error: cliError } = await supabase
        .from('clients')
        .select('id, name, phone, email, city, address')
        .eq('merchant_id', merchantId)

      if (cliError) throw cliError

      // 3. Fusionner les données (supporte schémas: client_id bigint ou uuid).
      const mergedData = (invData || []).map(inv => {
        const rawClientId = (inv as any)?.client_id
        const rawText = rawClientId === null || rawClientId === undefined ? '' : String(rawClientId).trim()
        const numericClientId = rawText && /^\d+$/.test(rawText) ? Number(rawText) : null

        // Fallback: if we couldn't store `client_id` because of uuid mismatch,
        // we store the numeric id in notes as `#client_num:123`.
        const notes = String((inv as any)?.notes || '')
        const match = notes.match(/#client_num:(\d+)/)
        const clientIdFromNotes = match?.[1] ? Number(match[1]) : null

        const candidateId = numericClientId ?? clientIdFromNotes

        return {
          ...inv,
          client_id: candidateId ?? rawClientId,
          clients: candidateId !== null
            ? cliData?.find(c => String(c.id) === String(candidateId))
            : undefined
        }
      })

      setInvoices(mergedData)
      
    } catch (error: any) {
      console.error('Fetch error:', error)
      setErrorMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!merchantId) return

    const channel = supabase
      .channel(`invoices-${merchantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'invoices',
        filter: `merchant_id=eq.${merchantId}`,
      }, () => {
        fetchData()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'invoices',
        filter: `merchant_id=eq.${merchantId}`,
      }, () => {
        fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel).catch(console.error) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  // --- Fonctions Utilitaires ---
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value || 0)
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    try {
      return new Date(date).toLocaleDateString('fr-FR')
    } catch {
      return '-'
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Brouillon' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente' },
      paid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Payée' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Annulée' }
    }
    const s = config[status] || config.draft
    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>
  }

  const handleMarkAsPaid = async (id: string) => {
    if (!confirm('Confirmer le paiement ?')) return
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid', 
          payment_date: new Date().toISOString() 
        })
        .eq('id', id)
      
      if (error) throw error
      
      await fetchData()
      setViewInvoiceModalOpen(false)
    } catch (e: any) { 
      alert(e.message) 
    }
  }

  // --- Filtrage ---
  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="p-20 text-center animate-pulse text-gray-500">Chargement des factures...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <div className={`flex ${hideHeader ? 'justify-end' : 'justify-between'} items-center`}>
        {!hideHeader && (
          <h2 className="text-2xl font-bold text-gray-800">Facturation</h2>
        )}
        <input 
          type="text" 
          placeholder="Rechercher par n° ou medecin..." 
          className="border p-2 rounded-lg w-64 outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">N° Facture</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Laboratoire</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Date</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Total</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Statut</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Aucune facture trouvée
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-blue-600">{inv.invoice_number}</td>
                  <td className="p-4 font-semibold">{inv.clients?.name || 'Laboratoire inconnu'}</td>
                  <td className="p-4 text-gray-500 text-sm">{formatDate(inv.date)}</td>
                  <td className="p-4 text-right font-bold">{formatCurrency((inv as any)?.total_ht ?? (inv as any)?.total_ttc ?? 0)}</td>
                  <td className="p-4">{getStatusBadge(inv.status)}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => { setSelectedInvoice(inv); setViewInvoiceModalOpen(true); }}
                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                    >
                      Voir détails
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Détails */}
      <Modal 
        isOpen={viewInvoiceModalOpen} 
        onClose={() => setViewInvoiceModalOpen(false)} 
        title="Détails de la Facture"
        size="lg"
      >
        {selectedInvoice && (
          <div className="space-y-6 text-gray-900 group">
            {/* Header avec un look moderne */}
            <div className="bg-slate-50 -mx-6 -mt-6 p-6 border-b border-slate-200 mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-[#714B67]/10 text-[#714B67] text-[10px] font-bold uppercase tracking-wider rounded">Facture</span>
                    <span className="text-slate-400 font-mono text-xs">#{selectedInvoice.id.slice(0, 8)}</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedInvoice.invoice_number}</h3>
                  <div className="flex items-center gap-4 mt-3 text-sm font-medium text-slate-500">
                    <div className="flex items-center gap-1.5 transition-colors hover:text-slate-900">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Ref Commande: <span className="text-slate-900 font-mono">{normalizeOrderRef(String((selectedInvoice as any)?.order_group_id || ''))}</span></span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Total TTC</div>
                    <div className="text-2xl font-black text-[#714B67]">{formatCurrency((selectedInvoice as any)?.total_ht ?? (selectedInvoice as any)?.total_ttc ?? 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Carte Medecin - Glassmorphism style */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-[#714B67]/5 to-transparent rounded-2xl -m-2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative border border-slate-200 rounded-2xl p-5 bg-white shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Information Médecin</span>
                  </div>
                  <div className="font-extrabold text-xl text-slate-900 mb-3">{selectedInvoice.clients?.name || 'Non spécifié'}</div>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                      <span>{[selectedInvoice.clients?.address, selectedInvoice.clients?.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}</span>
                    </div>
                    {selectedInvoice.clients?.phone && (
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="font-semibold text-slate-900">{selectedInvoice.clients.phone}</span>
                      </div>
                    )}
                    {selectedInvoice.clients?.email && (
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="font-medium">{selectedInvoice.clients.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Carte Info - Dates & Paiement */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Détails & Échéance</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <div className="text-sm font-bold text-slate-500">Date d'émission</div>
                    <div className="text-sm font-black text-slate-900 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-200">{formatDate(selectedInvoice.date)}</div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <div className="text-sm font-bold text-slate-500">Échéance de paiement</div>
                    <div className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">{formatDate(selectedInvoice.due_date)}</div>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <div className="text-sm font-bold text-slate-500">Mode de paiement</div>
                    <div className="text-sm font-black text-slate-900 uppercase tracking-wider">{selectedInvoice.payment_method || 'Non défini'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Articles Table - Native feel */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm mt-4">
              <div className="px-5 py-4 bg-slate-900 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Détails des articles</span>
                <span className="px-2 py-0.5 bg-white/10 text-white text-[10px] font-bold rounded">{(selectedInvoice.items || []).length} Lignes</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Article</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Qté</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">P.U</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedInvoice.items || []).length === 0 ? (
                      <tr><td className="p-8 text-center text-slate-400 italic font-medium" colSpan={4}>Aucun article répertorié</td></tr>
                    ) : (
                      (selectedInvoice.items || []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-900 text-sm">{String(item?.name || '')}</div>
                          </td>
                          <td className="p-4 text-sm text-right font-black text-slate-600 font-mono tracking-tighter">{Number(item?.quantity || 0)}</td>
                          <td className="p-4 text-sm text-right text-slate-600 font-medium">{formatCurrency(Number(item?.price || 0))}</td>
                          <td className="p-4 text-sm text-right font-black text-slate-900">{formatCurrency(Number(item?.price || 0) * Number(item?.quantity || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-slate-900 text-white flex justify-end">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Montant Net à Payer</span>
                  <span className="text-3xl font-black tracking-tighter text-white">{formatCurrency((selectedInvoice as any)?.total_ht ?? (selectedInvoice as any)?.total_ttc ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Notes Section if they exist */}
            {selectedInvoice.notes && (
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Observations</div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">{selectedInvoice.notes}</p>
              </div>
            )}

            {/* Actions Footer estilo pro */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-6 gap-4 border-t border-slate-200">
              <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                ID Système: {selectedInvoice.id}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                {selectedInvoice.status !== 'paid' && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                    className="px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all font-sans"
                  >
                    Valider le Paiement
                  </motion.button>
                )}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={emailSending}
                  onClick={() => sendInvoiceByEmail(selectedInvoice)}
                  className="px-6 py-3 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all flex items-center gap-2 font-sans"
                >
                  <Mail className="w-3 h-3" />
                  <span>{emailSending ? 'Envoi...' : 'Envoyer Email'}</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openInvoicePrintWindow(selectedInvoice)}
                  className="px-6 py-3 bg-[#714B67] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[#714B67]/20 hover:bg-[#5a3a52] transition-all flex items-center gap-2 font-sans"
                >
                  <FileText className="w-3 h-3" />
                  <span>Imprimer Facture</span>
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
