'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import { 
  ShoppingBag, 
  RefreshCw, 
  ChevronRight, 
  X, 
  Printer, 
  Calendar, 
  Package, 
  User, 
  Filter,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  CheckCircle2,
  Truck,
  BellRing,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  MapPinned,
  Tag,
  Layers,
  Receipt,
  Store,
  ArrowLeft
} from 'lucide-react'

interface OrdersPageProps {
  merchantId: string;
  products: any[];
  formatCurrency: (amount: number) => string;
  onPrintInvoice?: (group: any) => void;
  merchantInfo?: any;
}

interface OrderGroup {
  order_group_id: string;
  merchant_id: string;
  client_id: string;
  client?: any;
  orders: any[];
  created_at: string;
  updated_at: string;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'delivered' | 'cancelled';
}

export default function OrdersPage({ 
  merchantId, 
  products = [], 
  formatCurrency,
  onPrintInvoice,
  merchantInfo = {}
}: OrdersPageProps) {
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [newOrderAlert, setNewOrderAlert] = useState(false)
  const [companyInfo, setCompanyInfo] = useState<any>(merchantInfo)
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [sendDocsByEmail, setSendDocsByEmail] = useState(true)
  const [docEmailSending, setDocEmailSending] = useState<null | 'invoice' | 'delivery'>(null)
  const ITEMS_PER_PAGE = 8

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('merchant_send_docs_email')
    if (stored === 'true' || stored === 'false') setSendDocsByEmail(stored === 'true')
  }, [])

  const statusOptions = [
    { value: 'all', label: 'Toutes' },
    { value: 'pending', label: 'En attente' },
    { value: 'validated', label: 'Acceptée' },
    { value: 'processing', label: 'En cours' },
    { value: 'delivered', label: 'Livré' },
    { value: 'cancelled', label: 'Annulé' }
  ]

useEffect(() => {
  // On ne lance la récupération que si on a un ID et qu'on n'a pas encore les infos
  if (merchantId && !companyInfo?.company_name) {
    fetchCompanyInfo();
  }
}, [merchantId]); // On ne surveille QUE l'ID, pas l'objet companyInfo lui-même
  const fetchCompanyInfo = async () => {
    try {
      const { data } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .single()
      
      if (data) setCompanyInfo(data)
    } catch (err) {
      console.error('Erreur chargement infos entreprise:', err)
    }
  }
  const fetchOrderGroups = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError
      if (!ordersData?.length) {
        setOrderGroups([])
        setLoading(false)
        return
      }

      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('merchant_id', merchantId)

      const groupsMap = new Map<string, OrderGroup>()

      ordersData.forEach(order => {
        const groupId = order.order_group_id ||
                       `CMD-${new Date(order.created_at).getTime()}-${order.client_id}`

        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, {
            order_group_id: groupId,
            merchant_id: order.merchant_id,
            client_id: order.client_id,
            client: clientsData?.find(c => String(c.id) === String(order.client_id)) || null,
            orders: [],
            created_at: order.created_at,
            updated_at: order.created_at,
            total_items: 0,
            total_quantity: 0,
            total_amount: 0,
            status: order.status
          })
        }
        
        const group = groupsMap.get(groupId)!
        group.orders.push(order)
        group.total_items += 1
        group.total_quantity += order.quantity || 1
        group.updated_at = new Date(
          Math.max(new Date(group.updated_at).getTime(), new Date(order.created_at).getTime())
        ).toISOString()
        
        if (order.status === 'cancelled') group.status = 'cancelled'
        else if (order.status === 'delivered' && group.status !== 'cancelled') group.status = 'delivered'
        else if (order.status === 'processing' && group.status === 'pending') group.status = 'processing'
      })

      groupsMap.forEach(group => {
        group.total_amount = group.orders.reduce((sum, order) => {
          const product = products.find(p => String(p.id) === String(order.product_id))
          return sum + (product?.price || 0) * (order.quantity || 1)
        }, 0)
      })

      setOrderGroups(Array.from(groupsMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      
    } catch (err: any) {
      console.error('Erreur fetchOrderGroups:', err)
      setError(err.message || 'Erreur lors du chargement des commandes')
    } finally {
      setLoading(false)
    }
  }

  const showSystemNotification = (title: string, message: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico', 
        })
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
        audio.play().catch(() => {}) 
      } catch (e) {
        console.warn('Erreur native notification:', e)
      }
    }
  }

  useEffect(() => {
    if (merchantId) fetchOrderGroups()
  }, [merchantId, products])

  useEffect(() => {
    if (merchantId) fetchOrderGroups()
  }, [merchantId, products])

  // Removed redundant real-time subscription (now handled by MerchantDashboard)

  const pad4 = (n: number) => String(Math.max(0, Math.trunc(n))).padStart(4, '0')

  const normalizeOrderRef = (raw: string) => {
    const value = String(raw || '').trim()
    if (!value) return 'CMD-0000'
    if (/^cmd-\d{4}$/i.test(value) || /^CMD-\d{4}$/i.test(value)) return value.toUpperCase()
    const digits = value.replace(/\D/g, '')
    if (!digits) return `CMD-${pad4(Math.floor(1 + Math.random() * 9999))}`
    return `CMD-${digits.slice(-4).padStart(4, '0')}`
  }

  const getNextInvoiceNumber = async (merchantIdBigint: number) => {
    // Best-effort sequential number (INV-0001 ...). Unique index protects against collisions.
    const { data, error } = await supabase
      .from('invoices')
      .select('invoice_number, created_at')
      .eq('merchant_id', merchantIdBigint)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return `INV-${pad4(Math.floor(1 + Math.random() * 9999))}`
    }

    let max = 0
    for (const row of data || []) {
      const m = String((row as any)?.invoice_number || '').match(/INV-(\d{4})/i)
      if (!m?.[1]) continue
      const n = Number(m[1])
      if (Number.isFinite(n)) max = Math.max(max, n)
    }

    const next = (max % 9999) + 1
    return `INV-${pad4(next)}`
  }

  const buildInvoiceFromGroup = (group: OrderGroup, invoiceNumber: string) => {
    const items = (group.orders || []).map((order: any) => {
      const product = products.find(p => String(p.id) === String(order.product_id))
      return {
        name: product?.name || `Produit ${String(order.product_id).slice(-6)}`,
        price: Number(product?.price || 0),
        quantity: Number(order.quantity || 1),
      }
    })

    const totalHT = items.reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0)
    const tvaRate = 0
    const totalTTC = totalHT

    const date = new Date()
    const today = date.toISOString().split('T')[0]
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const clientIdRaw = (group as any)?.client_id
    const clientIdText = clientIdRaw === null || clientIdRaw === undefined ? '' : String(clientIdRaw).trim()
    const clientIdNumber = Number(clientIdText)

    const clientIdBigint = Number.isFinite(clientIdNumber) ? clientIdNumber : null

    const merchantIdNumber = Number(String(merchantId).trim())
    const merchantIdBigint = Number.isFinite(merchantIdNumber) ? merchantIdNumber : null

    return {
      invoice_number: String(invoiceNumber || '').trim(),
      merchant_id: merchantIdBigint,
      client_id: clientIdBigint,
      order_group_id: group.order_group_id,
      date: today,
      due_date: due,
      items,
      total_ht: totalHT,
      tva_rate: tvaRate,
      total_ttc: totalTTC,
      status: 'pending',
      payment_method: null,
      notes: [
        `Facture générée depuis commande ${group.order_group_id}`,
        `#order_group:${group.order_group_id}`,
        clientIdBigint ? `#client_num:${clientIdBigint}` : '',
        `#merchant_num:${String(merchantId).trim()}`,
        group.client?.name ? `#client_name:${String(group.client.name).replaceAll(' ', '_')}` : ''
      ].filter(Boolean).join(' '),
    }
  }

  const openPrintWindow = (invoice: any, group: OrderGroup) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const companyName = companyInfo?.company_name || companyInfo?.name || 'Entreprise.....'
    const companyEmail = companyInfo?.company_email || companyInfo?.email || ''
    const companyPhone = companyInfo?.company_phone || companyInfo?.phone || ''
    const companyAddress = companyInfo?.company_address || companyInfo?.address || ''
    const companyCity = companyInfo?.company_city || companyInfo?.city || ''

    const clientName = group.client?.name || 'Laboratoire'
    const clientCity = group.client?.city || ''
    const clientPhone = group.client?.phone || ''

    const items = Array.isArray(invoice?.items) ? invoice.items : []

    const totalHT = Number(invoice?.total_ht ?? 0)
    const tvaRate = Number(invoice?.tva_rate ?? 0)
    const tvaAmount = totalHT * (tvaRate / 100)
    const totalTTC = Number(invoice?.total_ttc ?? totalHT + tvaAmount)

    const fiscalLine = [
      companyInfo?.rc ? `RC: ${companyInfo.rc}` : '',
      companyInfo?.nif ? `NIF: ${companyInfo.nif}` : '',
      companyInfo?.nis ? `NIS: ${companyInfo.nis}` : '',
      companyInfo?.ai ? `AI: ${companyInfo.ai}` : '',
    ].filter(Boolean).join(' • ')
    const orderRef = normalizeOrderRef(group?.order_group_id || '')

    const htmlRows = items.map((item: any) => {
      const qty = Number(item.quantity || 0)
      const price = Number(item.price || 0)
      const line = qty * price
      return `
        <tr>
          <td class="desc">${String(item.name || '').replaceAll('<', '&lt;')}</td>
          <td class="qty">${qty}</td>
          <td class="unit">${price.toFixed(2)} DA</td>
          <td class="total">${line.toFixed(2)} DA</td>
        </tr>
      `
    }).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Facture ${invoice?.invoice_number || ''}</title>
          <meta charset="utf-8" />
          <style>
            :root { --ink:#0f172a; --muted:#475569; --line:#e2e8f0; --brand:#4f46e5; --bg:#ffffff; }
            * { box-sizing: border-box; }
            body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:var(--ink); background:var(--bg); }
            .wrap { max-width: 980px; margin: 32px auto; background:white; border:1px solid var(--line); border-radius: 16px; overflow:hidden; box-shadow: 0 10px 30px rgba(15,23,42,.06); }
            .topbar { display:flex; justify-content: space-between; align-items:center; padding: 18px 22px; border-bottom:1px solid var(--line); background: linear-gradient(90deg, rgba(79,70,229,.08), rgba(255,255,255,0)); }
            .btn { background: var(--brand); color:white; border:none; padding:10px 14px; border-radius: 10px; font-weight: 700; cursor:pointer; }
            .content { padding: 22px; }
            .h1 { font-size: 22px; font-weight: 900; letter-spacing:.08em; text-transform: uppercase; }
            .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: var(--brand); font-weight: 800; }
            .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 16px; }
            .card { border: 1px solid var(--line); border-radius: 14px; padding: 14px; background: #fff; }
            .label { font-size: 11px; font-weight: 800; letter-spacing:.12em; text-transform: uppercase; color: var(--muted); }
            .value { margin-top: 6px; font-weight: 800; }
            table { width:100%; border-collapse: collapse; margin-top: 18px; }
            th { text-align:left; font-size: 11px; letter-spacing:.12em; text-transform: uppercase; color: var(--muted); padding: 12px 10px; border-bottom: 1px solid var(--line); }
            td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; }
            td.qty, td.unit, td.total { text-align:right; white-space: nowrap; font-variant-numeric: tabular-nums; }
            .totals { display:flex; justify-content: flex-end; margin-top: 18px; }
            .totalsBox { width: 340px; border: 1px solid var(--line); border-radius: 14px; padding: 14px; background: #f8fafc; }
            .row { display:flex; justify-content: space-between; padding: 6px 0; color: var(--muted); font-weight: 700; }
            .row strong { color: var(--ink); }
            .grand { border-top:1px solid var(--line); margin-top: 8px; padding-top: 10px; color: var(--ink); font-size: 18px; }
            .foot { margin-top: 18px; padding-top: 12px; border-top: 1px dashed var(--line); color: var(--muted); font-size: 12px; display:flex; justify-content:space-between; gap:16px; }
            .sign { border:1px solid var(--line); border-radius: 12px; padding: 12px; min-height: 68px; color: var(--muted); background:#fff; }
            .no-print { }
            @media print { body { background: white; } .wrap { box-shadow: none; margin: 0; border:none; border-radius:0; } .no-print { display:none; } }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="topbar no-print">
              <div class="h1">Facture</div>
              <button class="btn" onclick="window.print()">Imprimer</button>
            </div>
            <div class="content">
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start;">
                <div>
                  <div class="h1">FACTURE</div>
                  <div class="mono" style="margin-top:8px;">${String(invoice?.invoice_number || '').replaceAll('<', '&lt;')}</div>
                  <div style="margin-top:8px; color:var(--muted); font-size:12px;">Commande: ${String(orderRef).replaceAll('<', '&lt;')}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:900;">${String(companyName).replaceAll('<', '&lt;')}</div>
                  <div style="color:var(--muted); font-size:12px; margin-top:6px;">
                    ${[companyAddress, companyCity].filter(Boolean).map((v: string) => String(v).replaceAll('<', '&lt;')).join('<br/>')}
                  </div>
                  <div style="color:var(--muted); font-size:12px; margin-top:6px;">
                    ${[companyPhone, companyEmail].filter(Boolean).map((v: string) => String(v).replaceAll('<', '&lt;')).join(' • ')}
                  </div>
                  ${fiscalLine ? `<div style="color:var(--muted); font-size:12px; margin-top:8px;">${String(fiscalLine).replaceAll('<', '&lt;')}</div>` : ''}
                </div>
              </div>

              <div class="grid">
                <div class="card">
                  <div class="label">Laboratoire Partenaire</div>
                  <div class="value">${String(clientName).replaceAll('<', '&lt;')}</div>
                  <div style="color:var(--muted); font-size:12px; margin-top:6px;">
                    ${[clientCity, clientPhone].filter(Boolean).map((v: string) => String(v).replaceAll('<', '&lt;')).join(' • ')}
                  </div>
                </div>
                <div class="card">
                  <div class="label">Dates</div>
                  <div style="margin-top:6px; display:flex; justify-content:space-between; font-size:12px; color:var(--muted); font-weight:800;">
                    <span>Emission</span><span>${String(invoice?.date || '').replaceAll('<', '&lt;')}</span>
                  </div>
                  <div style="margin-top:6px; display:flex; justify-content:space-between; font-size:12px; color:var(--muted); font-weight:800;">
                    <span>Echeance</span><span>${String(invoice?.due_date || '').replaceAll('<', '&lt;')}</span>
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align:right;">Qté</th>
                    <th style="text-align:right;">PU</th>
                    <th style="text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${htmlRows || `<tr><td class="desc" colspan="4" style="color:var(--muted);">Aucune ligne</td></tr>`}
                </tbody>
              </table>

              <div class="totals">
                <div class="totalsBox">
                  <div class="row"><span>Total HT</span><strong>${totalHT.toFixed(2)} DA</strong></div>
                  <div class="row"><span>TVA (${tvaRate.toFixed(0)}%)</span><strong>${tvaAmount.toFixed(2)} DA</strong></div>
                  <div class="row grand"><span>Total TTC</span><strong style="color:var(--brand);">${totalTTC.toFixed(2)} DA</strong></div>
                  ${tvaRate === 0 ? `<div style="margin-top:10px; font-size:12px; color:var(--muted); font-weight:800;">Non assujetti à la TVA</div>` : ''}
                </div>
              </div>

              <div class="foot">
                <div>Merci pour votre confiance.</div>
                <div class="sign">Signature / Cachet</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
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

  const sendMail = async (params: { to: string; subject: string; html: string; replyTo?: string; fromName?: string }) => {
    const base = getApiBaseUrl()
    const url = base ? `${base}/api/mail/send` : '/api/mail/send'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        merchantId: String(merchantId),
        sender: 'merchant',
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Envoi email échoué')
  }

  const buildInvoiceEmailHtml = (invoice: any, group: OrderGroup) => {
    const companyName = companyInfo?.company_name || companyInfo?.name || 'Entreprise'
    const companyEmail = companyInfo?.company_email || companyInfo?.email || ''
    const companyPhone = companyInfo?.company_phone || companyInfo?.phone || ''
    const companyAddress = companyInfo?.company_address || companyInfo?.address || ''
    const companyCity = companyInfo?.company_city || companyInfo?.city || ''

    const clientName = group.client?.name || 'Client'
    const clientEmail = group.client?.email || ''
    const clientPhone = group.client?.phone || ''
    const clientAddress = group.client?.address || ''
    const clientCity = group.client?.city || ''

    const items = Array.isArray(invoice?.items) ? invoice.items : []
    const totalHT = Number(invoice?.total_ht ?? 0)
    const tvaRate = Number(invoice?.tva_rate ?? 0)
    const tvaAmount = totalHT * (tvaRate / 100)
    const totalTTC = Number(invoice?.total_ttc ?? totalHT + tvaAmount)

    const rows = items
      .map((item: any) => {
        const name = escapeHtml(item?.name || '')
        const qty = Number(item?.quantity || 0)
        const price = Number(item?.price || 0)
        const line = qty * price
        return `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0;">${name}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${qty}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${price.toFixed(2)} DA</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700;">${line.toFixed(2)} DA</td>
          </tr>
        `
      })
      .join('')

    const fiscalLine = [
      companyInfo?.rc ? `RC: ${escapeHtml(companyInfo.rc)}` : '',
      companyInfo?.nif ? `NIF: ${escapeHtml(companyInfo.nif)}` : '',
      companyInfo?.nis ? `NIS: ${escapeHtml(companyInfo.nis)}` : '',
      companyInfo?.ai ? `AI: ${escapeHtml(companyInfo.ai)}` : '',
    ]
      .filter(Boolean)
      .join(' • ')

    return `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#0f172a;">
        <div style="max-width:760px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <div style="padding:18px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <div>
                <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:800;">Facture</div>
                <div style="margin-top:6px;font-size:20px;font-weight:900;">${escapeHtml(invoice?.invoice_number || '')}</div>
                <div style="margin-top:6px;color:#475569;font-size:12px;">Commande: ${escapeHtml(normalizeOrderRef(group?.order_group_id || ''))}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:900;">${escapeHtml(companyName)}</div>
                <div style="margin-top:6px;color:#475569;font-size:12px;line-height:1.4;">
                  ${[companyAddress, companyCity].filter(Boolean).map(escapeHtml).join('<br/>')}
                </div>
                <div style="margin-top:6px;color:#475569;font-size:12px;">
                  ${[companyPhone, companyEmail].filter(Boolean).map(escapeHtml).join(' • ')}
                </div>
                ${fiscalLine ? `<div style="margin-top:6px;color:#64748b;font-size:12px;">${fiscalLine}</div>` : ''}
              </div>
            </div>
          </div>

          <div style="padding:18px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
                <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:800;">Laboratoire Partenaire</div>
                <div style="margin-top:6px;font-weight:900;">${escapeHtml(clientName)}</div>
                <div style="margin-top:6px;color:#475569;font-size:12px;line-height:1.4;">
                  ${[clientAddress, clientCity].filter(Boolean).map(escapeHtml).join('<br/>')}
                </div>
                <div style="margin-top:6px;color:#475569;font-size:12px;">
                  ${[clientPhone, clientEmail].filter(Boolean).map(escapeHtml).join(' • ')}
                </div>
              </div>
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
                <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:800;">Dates</div>
                <div style="margin-top:8px;display:flex;justify-content:space-between;color:#475569;font-size:12px;font-weight:800;"><span>Émission</span><span>${escapeHtml(invoice?.date || '')}</span></div>
                <div style="margin-top:6px;display:flex;justify-content:space-between;color:#475569;font-size:12px;font-weight:800;"><span>Échéance</span><span>${escapeHtml(invoice?.due_date || '')}</span></div>
              </div>
            </div>

            <table style="width:100%;border-collapse:collapse;margin-top:14px;">
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

            <div style="margin-top:14px;color:#64748b;font-size:12px;">Merci pour votre confiance.</div>
          </div>
        </div>
      </div>
    `
  }

  const sendInvoiceEmail = async (invoice: any, group: OrderGroup) => {
    const to = String(group?.client?.email || '').trim()
    if (!to) {
      alert('Email du laboratoire manquant. Ajoutez-le dans la fiche établissement.')
      return
    }

    const replyTo = String(companyInfo?.company_email || companyInfo?.email || '').trim() || undefined
    const fromName = String(companyInfo?.company_name || companyInfo?.name || 'Fournisseur').trim() || undefined

    try {
      setDocEmailSending('invoice')
      await sendMail({
        to,
        subject: `Facture ${String(invoice?.invoice_number || '').trim()}`,
        html: buildInvoiceEmailHtml(invoice, group),
        replyTo,
        fromName,
      })
      alert('✅ Facture envoyée par email')
    } catch (e: any) {
      console.error('Send invoice email failed', e)
      if (String(e?.message || '').toLowerCase().includes('failed to fetch')) {
        const base = getApiBaseUrl()
        alert(
          `Serveur email/API indisponible.\n\n` +
            `- Lance le serveur (npm run dev) si tu es en local.\n` +
            `- Ou configure l'URL serveur dans Paramètres → Emails & notifications.\n\n` +
            `URL: ${base || '(relative /api)'}\n`
        )
      } else {
        alert(e?.message || "Impossible d'envoyer la facture par email")
      }
    } finally {
      setDocEmailSending(null)
    }
  }

  const buildDeliveryEmailHtml = (group: OrderGroup, clientInfo: any, deliveryNoteNumber: string, dateFormatted: string) => {
    const companyName = companyInfo?.company_name || companyInfo?.name || 'Entreprise'
    const companyEmail = companyInfo?.company_email || companyInfo?.email || ''
    const companyPhone = companyInfo?.company_phone || companyInfo?.phone || ''
    const companyAddress = companyInfo?.company_address || companyInfo?.address || ''
    const companyCity = companyInfo?.company_city || companyInfo?.city || ''

    const clientName = clientInfo?.name || group.client?.name || 'Client'
    const clientEmail = clientInfo?.email || group.client?.email || ''
    const clientPhone = clientInfo?.phone || group.client?.phone || ''
    const clientAddress = clientInfo?.address || group.client?.address || ''
    const clientCity = clientInfo?.city || group.client?.city || ''

    const rows = (group.orders || [])
      .map((order: any) => {
        const product = products.find(p => String(p.id) === String(order.product_id))
        const name = escapeHtml(product?.name || `Produit ${String(order.product_id).slice(-6)}`)
        const qty = Number(order.quantity || 0)
        const price = Number(product?.price || 0)
        const line = qty * price
        return `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0;">${name}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${qty}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${price.toFixed(2)} DA</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700;">${line.toFixed(2)} DA</td>
          </tr>
        `
      })
      .join('')

    const totalHT = (group.orders || []).reduce((sum: number, order: any) => {
      const product = products.find(p => String(p.id) === String(order.product_id))
      return sum + (Number(product?.price || 0) * Number(order.quantity || 0))
    }, 0)

    return `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#0f172a;">
        <div style="max-width:760px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <div style="padding:18px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <div>
                <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:800;">Bon de livraison</div>
                <div style="margin-top:6px;font-size:18px;font-weight:900;">${escapeHtml(deliveryNoteNumber)}</div>
                <div style="margin-top:6px;color:#475569;font-size:12px;">Commande: ${escapeHtml(normalizeOrderRef(group?.order_group_id || ''))} • ${escapeHtml(dateFormatted)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:900;">${escapeHtml(companyName)}</div>
                <div style="margin-top:6px;color:#475569;font-size:12px;line-height:1.4;">
                  ${[companyAddress, companyCity].filter(Boolean).map(escapeHtml).join('<br/>')}
                </div>
                <div style="margin-top:6px;color:#475569;font-size:12px;">
                  ${[companyPhone, companyEmail].filter(Boolean).map(escapeHtml).join(' • ')}
                </div>
              </div>
            </div>
          </div>

          <div style="padding:18px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
                <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:800;">Destinataire</div>
                <div style="margin-top:6px;font-weight:900;">${escapeHtml(clientName)}</div>
                <div style="margin-top:6px;color:#475569;font-size:12px;line-height:1.4;">
                  ${[clientAddress, clientCity].filter(Boolean).map(escapeHtml).join('<br/>')}
                </div>
                <div style="margin-top:6px;color:#475569;font-size:12px;">
                  ${[clientPhone, clientEmail].filter(Boolean).map(escapeHtml).join(' • ')}
                </div>
              </div>
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
                <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:800;">Infos</div>
                <div style="margin-top:8px;display:flex;justify-content:space-between;color:#475569;font-size:12px;font-weight:800;"><span>Référence</span><span>${escapeHtml(normalizeOrderRef(group?.order_group_id || ''))}</span></div>
                <div style="margin-top:6px;display:flex;justify-content:space-between;color:#475569;font-size:12px;font-weight:800;"><span>Date</span><span>${escapeHtml(dateFormatted)}</span></div>
              </div>
            </div>

            <table style="width:100%;border-collapse:collapse;margin-top:14px;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">Produit</th>
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
                <div style="display:flex;justify-content:space-between;font-weight:900;"><span>Total</span><span style="color:#4f46e5;">${totalHT.toFixed(2)} DA</span></div>
                <div style="margin-top:10px;font-size:12px;color:#64748b;font-weight:800;">Non assujetti à la TVA</div>
              </div>
            </div>

            <div style="margin-top:14px;color:#64748b;font-size:12px;">Bon à servir • Signature / Cachet</div>
          </div>
        </div>
      </div>
    `
  }

  const sendDeliveryNoteEmail = async (group: OrderGroup, clientInfo: any, deliveryNoteNumber: string, dateFormatted: string) => {
    const to = String(clientInfo?.email || group?.client?.email || '').trim()
    if (!to) {
      alert('Email du laboratoire manquant. Ajoutez-le dans la fiche établissement.')
      return
    }

    const replyTo = String(companyInfo?.company_email || companyInfo?.email || '').trim() || undefined
    const fromName = String(companyInfo?.company_name || companyInfo?.name || 'Fournisseur').trim() || undefined

    try {
      setDocEmailSending('delivery')
      await sendMail({
        to,
        subject: `Bon de livraison ${deliveryNoteNumber}`,
        html: buildDeliveryEmailHtml(group, clientInfo, deliveryNoteNumber, dateFormatted),
        replyTo,
        fromName,
      })
      alert('✅ Bon de livraison envoyé par email')
    } catch (e: any) {
      console.error('Send BL email failed', e)
      if (String(e?.message || '').toLowerCase().includes('failed to fetch')) {
        const base = getApiBaseUrl()
        alert(
          `Serveur email/API indisponible.\n\n` +
            `- Lance le serveur (npm run dev) si tu es en local.\n` +
            `- Ou configure l'URL serveur dans Paramètres → Emails & notifications.\n\n` +
            `URL: ${base || '(relative /api)'}\n`
        )
      } else {
        alert(e?.message || "Impossible d'envoyer le bon de livraison par email")
      }
    } finally {
      setDocEmailSending(null)
    }
  }

  const handleGenerateInvoice = async (group: OrderGroup) => {
    if (!group?.order_group_id) return

    const ok = confirm(`Générer une facture pour la commande ${normalizeOrderRef(group.order_group_id)} ?`)
    if (!ok) return

    try {
      // 1) Vérifier si une facture existe déjà pour cette commande.
      // On préfère une colonne dédiée `order_group_id` si elle existe, sinon on retombe sur un tag dans `notes`.
      let existingInvoice: any = null

      const merchantIdNumber = Number(String(merchantId).trim())
      const merchantIdBigint = Number.isFinite(merchantIdNumber) ? merchantIdNumber : null
      if (merchantIdBigint === null) throw new Error('merchantId invalide (doit être numérique)')

      const checkByColumn = await supabase
        .from('invoices')
        .select('id, invoice_number, date, due_date, items, total_ht, tva_rate, total_ttc, status, notes')
        .eq('merchant_id', merchantIdBigint)
        // @ts-ignore - colonne optionnelle selon schéma
        .eq('order_group_id', group.order_group_id)
        .limit(1)

      if (!checkByColumn.error) {
        existingInvoice = checkByColumn.data?.[0] || null
      } else {
        const checkByNotes = await supabase
          .from('invoices')
          .select('id, invoice_number, date, due_date, items, total_ht, tva_rate, total_ttc, status, notes')
          .eq('merchant_id', merchantIdBigint)
          .ilike('notes', `%#order_group:${group.order_group_id}%`)
          .limit(1)

        if (checkByNotes.error) throw checkByNotes.error
        existingInvoice = checkByNotes.data?.[0] || null
      }

      if (existingInvoice) {
        const again = confirm('Une facture existe déjà pour cette commande. Voulez-vous l’imprimer ?')
        if (again) {
          openPrintWindow(existingInvoice, group)
          if (sendDocsByEmail) void sendInvoiceEmail(existingInvoice, group)
        }
        return
      }

      // 2) Créer la facture.
      const invoiceNumber = await getNextInvoiceNumber(merchantIdBigint)
      const payload: any = buildInvoiceFromGroup(group, invoiceNumber)

      // Retry a couple times if invoice_number collides (rare, but possible in concurrent generation).
      let lastError: any = null
      let inserted: any = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const numberToUse = attempt === 0 ? invoiceNumber : `INV-${pad4(Math.floor(1 + Math.random() * 9999))}`
        const tryPayload = attempt === 0 ? payload : buildInvoiceFromGroup(group, numberToUse)

        const insertTry = await supabase
          .from('invoices')
          .insert([tryPayload])
          .select('*')
          .single()

        if (!insertTry.error) {
          inserted = insertTry.data
          lastError = null
          break
        }

        lastError = insertTry.error
        if (String(insertTry.error?.code) !== '23505') break
      }

      if (inserted) {
        alert('Facture générée')
        openPrintWindow(inserted, group)
        if (sendDocsByEmail) void sendInvoiceEmail(inserted, group)
        return
      }

      if (lastError) throw lastError
    } catch (err: any) {
      console.error('Erreur génération facture:', err)
      const msg = String(err?.message || '')
      alert(msg || 'Erreur lors de la génération de la facture')
    }
  }

  const decrementStockForOrders = async (orders: any[]) => {
    const quantityByProduct: Record<string, number> = {}

    orders.forEach(order => {
      const productId = String(order.product_id)
      const quantity = Number(order.quantity || 0)
      if (!productId || quantity <= 0) return
      quantityByProduct[productId] = (quantityByProduct[productId] || 0) + quantity
    })

    if (!Object.keys(quantityByProduct).length) return

    await Promise.all(Object.entries(quantityByProduct).map(async ([productId, quantityToDeduct]) => {
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single()

      if (fetchError) throw fetchError

      const currentStock = Number(product?.stock_quantity ?? 0)
      const updatedStock = Math.max(currentStock - quantityToDeduct, 0)

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock_quantity: updatedStock })
        .eq('id', productId)

      if (updateError) throw updateError
    }))
  }

  const handleUpdateGroupStatus = async (groupId: string, newStatus: string) => {
    setStatusUpdateLoading(true)
    try {
      const group = orderGroups.find(g => g.order_group_id === groupId) || selectedGroup
      if (!group) throw new Error('Groupe introuvable')
      const orderIds = group.orders.map((order: any) => order.id)
      if (orderIds.length === 0) throw new Error('Aucune commande à mettre à jour')
      if (newStatus === 'delivered' && group.status !== 'delivered') {
        await decrementStockForOrders(group.orders)
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', orderIds)

      if (updateError) throw updateError

      setOrderGroups(prev => prev.map(group =>
        group.order_group_id === groupId
          ? { ...group, status: newStatus as any, orders: group.orders.map(o => ({ ...o, status: newStatus })) }
          : group
      ))

      setSelectedGroup(prev => prev?.order_group_id === groupId
        ? { ...prev, status: newStatus as any, orders: prev.orders.map(o => ({ ...o, status: newStatus })) }
        : prev
      )

      const clientId = group.client?.id || selectedGroup?.client?.id
      if (clientId) {
        try {
          const statusLabels: any = {
            pending: 'en attente',
            validated: 'Acceptée',
            processing: 'en cours de préparation',
            delivered: 'Livrée',
            cancelled: 'Annulée'
          }
          await supabase.from('notifications').insert({
            client_id: clientId,
            merchant_id: merchantId,
            title: 'Mise à jour commande',
            message: `Votre commande ${groupId} est maintenant ${statusLabels[newStatus as keyof typeof statusLabels] || newStatus}`,
            created_at: new Date().toISOString(),
            read: false
          })

          // Envoyer l'email automatique au client
          const clientEmail = group.client?.email
          if (clientEmail) {
            const apiBase = typeof window !== 'undefined' ? window.localStorage.getItem('app_api_base_url') : ''
            fetch(apiBase ? `${apiBase}/api/notify/status` : '/api/notify/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                merchantId,
                merchantEmail: companyInfo?.company_email || companyInfo?.email || '',
                merchantName: companyInfo?.company_name || companyInfo?.name || 'Fournisseur',
                clientEmail,
                clientName: group.client?.name || 'Client',
                orderGroupId: groupId,
                status: newStatus,
                currency: companyInfo?.currency || '',
                totalAmount: group.total_amount
              })
            }).catch(e => console.error('Erreur envoi email statut:', e))
          }
        } catch (notifErr) { 
          console.error('❌ Erreur notification:', notifErr) 
        }
      }
    } catch (err: any) {
      console.error('❌ Erreur update status:', err)
      alert(`Erreur: ${err.message}`)
    } finally {
      setStatusUpdateLoading(false)
    }
  }

  const handlePrintDeliveryNote = async (group: OrderGroup) => {
    try {
      // Récupérer les informations du marchand
      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .single();

      // Récupérer les informations du client avec son client_id
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', group.client_id)
        .single();

      const clientInfo = client || group.client || {};
      const merchantInfo = merchant || {};

      const merchantNumeroAi =
        (merchantInfo as any)?.['numéro_ai'] || (merchantInfo as any)?.numero_ai || (merchantInfo as any)?.ai || ''
      const clientTelephone =
        (clientInfo as any)?.['téléphone'] || (clientInfo as any)?.telephone || (clientInfo as any)?.phone || ''
      const clientNumeroFiscal =
        (clientInfo as any)?.['numéro_fiscal'] ||
        (clientInfo as any)?.numero_fiscal ||
        (clientInfo as any)?.fiscal_number ||
        ''

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) { 
        alert('Veuillez autoriser les popups'); 
        return; 
      }

      const today = new Date();
      const dateFormatted = today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const shortId = normalizeOrderRef(group.order_group_id);
      const deliveryNoteNumber = `BL-${shortId}-${dateFormatted.replace(/\//g, '')}`;

      const companyName = companyInfo?.Nom_de_l_entreprise || companyInfo?.company_name || 'DiagnoSphère';
      const companyPhone =
        (companyInfo as any)?.['téléphone_de_l_entreprise'] ||
        (companyInfo as any)?.telephone_de_l_entreprise ||
        companyInfo?.company_phone ||
        '0560277868';
      const companyAddress = companyInfo?.adresse_de_l_entreprise || companyInfo?.company_address || 'Alger, Algérie';
      const currency = companyInfo?.devise || companyInfo?.currency || '';

      const formatCurrencyBL = (amount: number) => {
        return new Intl.NumberFormat('fr-DZ', {
          style: 'currency',
          currency: 'DZD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount).replace('', '').trim() + ' ';
      };

      const htmlContent = 
	  `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>BL ${shortId}</title>
  <style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }

  @page {
    size: A4;
    margin: 1.5cm;
  }

  body {
    background: #ffffff;
    color: #1e293b;
    font-size: 9.5pt;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
  }

  /* Header Design */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 40px;
    padding-bottom: 20px;
    border-bottom: 1px solid #f1f5f9;
  }

  .company-name {
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.04em;
    margin-bottom: 8px;
  }

  .company-details {
    color: #64748b;
    font-size: 8.5pt;
    line-height: 1.5;
  }

  .document-info {
    text-align: right;
  }

  .document-title {
    font-size: 14pt;
    font-weight: 700;
    color: #2563eb;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }

  .document-ref-main {
    font-size: 11pt;
    font-weight: 600;
    color: #0f172a;
  }

  /* Fiscal Grid - Elegant Row */
  .fiscal-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 40px;
    padding: 15px 25px;
    background: #f8fafc;
    border-radius: 12px;
  }

  .fiscal-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    font-weight: 700;
    display: block;
    margin-bottom: 2px;
  }

  .fiscal-value {
    font-size: 9pt;
    font-weight: 600;
    color: #334155;
  }

  /* Parties (Client & Delivery) */
  /* Parties (Client & Delivery) */
.parties-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 15px;
}

.party-title {
  font-size: 8pt;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 5px;
}

/* Conteneur pour les infos client et fiscales côte à côte */
.client-info-container {
  display: flex;
  gap: 15px;
}

.client-info-left {
  flex: 1;
}

.client-info-right {
  flex: 0.8;
  border-left: 1px dashed #e2e8f0;
  padding-left: 12px;
}

.party-content strong {
  color: #0f172a;
  font-size: 10.5pt;
  display: block;
  margin-bottom: 6px;
}

.party-content p {
  color: #475569;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 8.5pt;
}

.party-content i {
  color: #94a3b8;
  width: 14px;
  font-size: 8pt;
}

/* Style pour les informations fiscales */
.fiscal-info-title {
  font-size: 7pt;
  font-weight: 600;
  color: #2563eb;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.fiscal-item-small {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 8pt;
}

.fiscal-item-small .label {
  color: #64748b;
}

.fiscal-item-small .value {
  font-weight: 600;
  color: #334155;
}

/* Livraison info compact */
.delivery-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.delivery-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  border-bottom: 1px dotted #f1f5f9;
}

.delivery-label {
  color: #64748b;
  font-size: 8pt;
}

.delivery-value {
  font-weight: 500;
  color: #1e293b;
  font-size: 8.5pt;
}

.payment-badge {
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 7.5pt;
  font-weight: 500;
}

  /* Table Design */
  .products-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 30px;
  }

  .products-table th {
    text-align: left;
    padding: 12px 10px;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    border-bottom: 2px solid #0f172a;
  }

  .products-table td {
    padding: 15px 10px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
  }

  .product-name {
    font-weight: 600;
    color: #0f172a;
    font-size: 10pt;
    margin-bottom: 5px;
  }

  .product-detail-item {
    display: inline-flex;
    font-size: 7pt;
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 4px;
    color: #475569;
    margin-right: 5px;
    font-weight: 500;
  }

  .price-cell {
    font-weight: 500;
    color: #334155;
    text-align: right;
  }

  .total-cell {
    font-weight: 700;
    color: #0f172a;
    text-align: right;
  }

  /* Totals Box */
  .totals-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .totals-box {
    width: 280px;
  }

  .total-line {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 9pt;
    color: #64748b;
  }

  .grand-total {
    border-top: 1px solid #e2e8f0;
    margin-top: 10px;
    padding-top: 15px;
    font-weight: 800;
    font-size: 13pt;
    color: #2563eb;
  }

  /* Bottom Section */
  .bottom-section {
    margin-top: 50px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .no-tax-stamp {
    border: 2px double #cbd5e1;
    color: #94a3b8;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    transform: rotate(-2deg);
  }

  .signature-box {
    text-align: center;
    width: 200px;
  }

  .signature-line {
    border-bottom: 1px solid #0f172a;
    height: 40px;
    margin-bottom: 10px;
  }

  .footer {
    position: fixed;
    bottom: 1.5cm;
    left: 1.5cm;
    right: 1.5cm;
    text-align: center;
    font-size: 7.5pt;
    color: #94a3b8;
    border-top: 1px solid #f1f5f9;
    padding-top: 15px;
  }
</style>
</head>
<body>
 <div class="header-minimal">
  <div class="header-left">
    <div class="brand-name">${merchantInfo?.nom || 'DiagnoSphere'}</div>
    <div class="brand-contact">
      ${[merchantInfo?.company_address || merchantInfo?.address || '', merchantInfo?.company_city || merchantInfo?.city || ''].filter(Boolean).join(', ')}<br>
      Tél: ${merchantInfo?.company_phone || merchantInfo?.phone || '—'} | ${merchantInfo?.company_email || merchantInfo?.email || '—'}
    </div>
  </div>
  <div class="header-right">
    <div class="doc-badge">BON DE LIVRAISON</div>
    <div class="doc-meta">N° <strong>${deliveryNoteNumber}</strong></div>
    <div class="doc-meta" style="color:#3b82f6;">Date: ${dateFormatted}</div>
  </div>
</div>

<div class="fiscal-strip">
  <span><strong>NIF:</strong> ${merchantInfo?.nif || '—'}</span>
  <span><strong>RC:</strong> ${merchantInfo?.rc || '—'}</span>
  <span><strong>AI:</strong> ${merchantNumeroAi || '—'}</span>
  <span><strong>NIS:</strong> ${merchantInfo?.nis || '—'}</span>
</div>

<div class="info-grid">
  <div class="info-card">
    <div class="card-tag">DESTINATAIRE</div>
    <div class="client-main">
      <div class="client-name">${clientInfo?.nom || clientInfo?.name || 'DR ANWAR'}</div>
      <div class="client-sub">
        <span>ID: ${clientInfo?.client_id || '—'}</span> | 
        <span><i class="fas fa-phone"></i> ${clientTelephone || '—'}</span>
      </div>
      <div class="client-sub">${clientInfo?.ville || '—'} ${clientInfo?.code_postal || ''}</div>
    </div>
    
    <div class="client-fiscal-tags">
      ${clientInfo?.rc ? `<span class="tag">RC: ${clientInfo.rc}</span>` : ''}
      ${clientInfo?.fiscal_number ? `<span class="tag">NIF: ${clientInfo.fiscal_number}</span>` : ''}
      ${clientInfo?.ai_number ? `<span class="tag">AI: ${clientInfo.ai_number}</span>` : ''}
    </div>
  </div>

  <div class="info-card">
    <div class="card-tag">LOGISTIQUE</div>
    <div class="log-details">
      <div class="log-row"><span>Commande:</span> <strong>${group?.order_group_id ? normalizeOrderRef(group.order_group_id) : '—'}</strong></div>
      <div class="log-row"><span>Articles:</span> <strong>${group?.total_items || 0}</strong></div>
      <div class="log-row"><span>Paiement:</span> <span class="pay-mode">${clientInfo?.payment_mode || 'Non spécifié'}</span></div>
    </div>
  </div>
</div>

<style>
  /* CSS pour le rendu minimaliste */
  .header-minimal { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 2px solid #1e293b; padding-bottom: 8px; }
  .brand-name { font-size: 16pt; font-weight: 800; color: #1e293b; line-height: 1; }
  .brand-contact { font-size: 8pt; color: #64748b; margin-top: 4px; }
  .doc-badge { background: #1e293b; color: white; padding: 4px 10px; font-size: 10pt; font-weight: 700; border-radius: 4px; text-align: right; }
  .doc-meta { font-size: 9pt; text-align: right; margin-top: 2px; }

  .fiscal-strip { display: flex; justify-content: space-between; background: #f8fafc; padding: 5px 10px; border-radius: 4px; font-size: 7.5pt; color: #475569; margin-bottom: 12px; border: 1px solid #e2e8f0; }

  .info-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 15px; margin-bottom: 15px; }
  .info-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; position: relative; }
  .card-tag { font-size: 6.5pt; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 5px; }
  
  .client-name { font-size: 11pt; font-weight: 700; color: #1e293b; }
  .client-sub { font-size: 8.5pt; color: #475569; margin-top: 2px; }
  .client-fiscal-tags { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
  .tag { font-size: 7pt; background: #eff6ff; color: #1d4ed8; padding: 1px 5px; border-radius: 3px; font-weight: 600; }

  .log-details { font-size: 8.5pt; }
  .log-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed #f1f5f9; }
  .pay-mode { color: #059669; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; }
</style>
  <!-- Tableau des produits avec Détails -->
  <div class="products-section">
    <table class="products-table">
  <thead>
    <tr>
      <th>Désignation Produit</th>
      <th>Volume</th>
      <th>Lot / Référence</th>
      <th>Origine</th>
      <th class="text-right">Qté</th>
      <th class="text-right"></th>
      <th class="text-right"></th>
    </tr>
  </thead>
  <tbody>
    ${group.orders.map((order: any) => {
      const product = products.find((p: any) => String(p.id) === String(order.product_id));
      const totalRow = (product?.price || 0) * (order.quantity || 1);
      
      return `
        <tr>
          <td class="product-name-cell">${product?.name || 'Produit'}</td>
          <td class="nowrap">${product?.volume_ml || '-'} ml</td>
          <td>
            <div class="ref-container">
              ${product?.lot_number ? `<span>L: ${product.lot_number}</span>` : ''}
              ${product?.reference_code ? `<span>R: ${product.reference_code}</span>` : ''}
            </div>
          </td>
          <td class="nowrap">${product?.provenance || 'N/A'}</td>
          <td class="text-right font-bold">${order.quantity || 1}</td>
          
        </tr>
      `;
    }).join('')}
  </tbody>
</table>

<style>
  .products-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    table-layout: auto; /* Laisse le tableau s'ajuster */
  }

  .products-table th {
    background: #f8fafc;
    color: #64748b;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 10px;
    border-bottom: 2px solid #1e293b;
    text-align: left;
  }

  .products-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 8.5pt;
    color: #1e293b;
    vertical-align: middle;
    white-space: nowrap; /* Empêche les retours à la ligne par défaut */
  }

  /* Colonne produit autorisée à s'étendre */
  .product-name-cell {
    white-space: normal !important; /* Permet le retour à la ligne uniquement pour le nom long */
    font-weight: 600;
    min-width: 150px;
  }

  .ref-container {
    display: flex;
    gap: 8px;
    font-size: 7.5pt;
    color: #64748b;
  }

  .ref-container span {
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .text-right { text-align: right !important; }
  .font-bold { font-weight: 700; }
  .nowrap { white-space: nowrap; }

  /* Évite que le tableau ne soit coupé par le footer fixe */
  body {
    padding-bottom: 180px; 
  }
</style>
  </div>
<div class="document">

  <!-- HEADER -->
  <div class="header-section">...</div>

  <!-- PRODUITS -->
  <div class="products-section">...</div>

  <!-- BAS -->
  <div class="totals-section">

 

    <!-- Signature -->
    <div class="stamp-section">
      <div class="signature-area">
        <div class="signature-line"></div>
        <div>Cachet et signature</div>
        <div style="margin-top: 10px; font-size: 8pt;">Bon à servir</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      BL ${deliveryNoteNumber} - Généré le ${new Date().toLocaleString('fr-FR')} - Document commercial — Non assujetti à la TVA
    </div>

  </div>

</div>
  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    }
  </script>
</body>
</html>`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      if (sendDocsByEmail) void sendDeliveryNoteEmail(group, clientInfo, deliveryNoteNumber, dateFormatted)
    } catch (error) {
      console.error('Erreur lors de la génération du bon de livraison:', error);
      alert('Erreur lors de la génération du bon de livraison');
    }
  };

  const filteredGroups = orderGroups.filter(group => statusFilter === 'all' || group.status === statusFilter);
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1) }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'delivered': return { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Livrée' };
      case 'processing': return { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'En cours' };
      case 'cancelled': return { color: 'bg-red-100 text-red-800', icon: X, label: 'Annulée' };
      default: return { color: 'bg-amber-100 text-amber-800', icon: AlertCircle, label: 'En attente' };
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedGroup(null);
  };

  const handleOpenOrderDetail = (group: OrderGroup) => {
    setSelectedGroup(group);
    setViewMode('detail');
  };

  if (loading && orderGroups.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-700 font-medium">Chargement des commandes...</p>
      </div>
    );
  }

  if (error && orderGroups.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md text-center border border-red-200">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <p className="text-xl font-bold text-gray-900 mb-2">Oups ! Erreur de chargement</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={fetchOrderGroups} 
            className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  // AFFICHAGE DU DÉTAIL COMMANDE EN GRAND ONGLET
  if (viewMode === 'detail' && selectedGroup) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header du détail */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-6 py-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToList}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <span>Commande</span>
                    <span className="font-mono text-sm bg-gray-100 text-gray-800 px-3 py-1.5 rounded-full">
                      {normalizeOrderRef(selectedGroup.order_group_id)}
                    </span>
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Détails complets de la commande
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedGroup.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                  selectedGroup.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  selectedGroup.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {getStatusBadge(selectedGroup.status).label}
                </span>

                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={sendDocsByEmail}
                    onChange={(e) => {
                      const next = e.target.checked
                      setSendDocsByEmail(next)
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('merchant_send_docs_email', String(next))
                      }
                    }}
                    disabled={docEmailSending !== null}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span>Envoyer par email</span>
                  {docEmailSending ? (
                    <span className="text-xs text-gray-500">
                      {docEmailSending === 'invoice' ? 'Envoi facture…' : 'Envoi BL…'}
                    </span>
                  ) : null}
                </label>
                <button
                  onClick={() => handlePrintDeliveryNote(selectedGroup)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Bon de livraison
                </button>
                <Button
                  variant="primary"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                  icon={<Receipt className="w-4 h-4" />}
                  onClick={() => handleGenerateInvoice(selectedGroup)}
                >
                  Générer facture
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Contenu du détail */}
        <div className="px-6 py-8 max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="space-y-8">
              
              {/* EN-TÊTE AVEC STATUT */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Package className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      Commande #{normalizeOrderRef(selectedGroup.order_group_id)}
                    </div>
                    <div className="text-sm text-gray-600 font-mono">
                      Référence complète: {selectedGroup.order_group_id}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Date de commande</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {new Date(selectedGroup.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              {/* INFORMATIONS MEDECIN */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-800" />
                  Informations medecin
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-blue-700 mb-1">Nom</p>
                    <p className="font-semibold text-gray-900 text-lg">
                      {selectedGroup.client?.name || 'Client'}
                    </p>
                  </div>
                  {selectedGroup.client?.phone && (
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Téléphone</p>
                      <p className="text-gray-800">{selectedGroup.client.phone}</p>
                    </div>
                  )}
                  {selectedGroup.client?.email && (
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Email</p>
                      <p className="text-gray-800">{selectedGroup.client.email}</p>
                    </div>
                  )}
                  {selectedGroup.client?.city && (
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Ville</p>
                      <p className="text-gray-800">
                        {selectedGroup.client.city}
                        {selectedGroup.client.wilaya && `, ${selectedGroup.client.wilaya}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* RÉCAPITULATIF */}
              <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200">
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-800" />
                  Récapitulatif de la commande
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-600 mb-1">Nombre d'articles</p>
                    <p className="text-3xl font-bold text-gray-900">{selectedGroup.total_items}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-600 mb-1">Quantité totale</p>
                    <p className="text-3xl font-bold text-gray-900">{selectedGroup.total_quantity}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-600 mb-1">Statut</p>
                    <p className={`text-lg font-bold ${
                      selectedGroup.status === 'delivered' ? 'text-emerald-700' :
                      selectedGroup.status === 'processing' ? 'text-blue-700' :
                      selectedGroup.status === 'cancelled' ? 'text-red-700' :
                      'text-amber-700'
                    }`}>
                      {getStatusBadge(selectedGroup.status).label}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-4 rounded-lg shadow-lg">
                    <p className="text-xs text-white/90 mb-1">Total TTC</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(selectedGroup.total_amount)}</p>
                  </div>
                </div>
              </div>

              {/* LISTE DES PRODUITS */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Articles commandés ({selectedGroup.orders.length})
                </h3>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Produit</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Référence</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Quantité</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Prix unitaire</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {selectedGroup.orders.map((order, idx) => {
                        const product = products.find(p => String(p.id) === String(order.product_id));
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                                  {product?.image_data ? (
                                    <img src={product.image_data} alt={product.name} className="w-full h-full rounded-lg object-cover" />
                                  ) : (
                                    <Package className="w-6 h-6 text-gray-500" />
                                  )}
                                </div>
                                <span className="font-medium text-gray-900">{product?.name || 'Produit'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-800">
                                {String(order.product_id || '').slice(-8) || 'N/A'}
                              </code>
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-gray-900">{order.quantity || 1}</td>
                            <td className="px-6 py-4 text-right text-gray-700">{formatCurrency(product?.price || 0)}</td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-700">
                              {formatCurrency((product?.price || 0) * (order.quantity || 1))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-right font-bold text-gray-800">Total commande</td>
                        <td className="px-6 py-4 text-right font-bold text-2xl text-emerald-700">
                          {formatCurrency(selectedGroup.total_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* DATES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Date de création</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedGroup.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Dernière mise à jour</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedGroup.updated_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* BOUTONS D'ACTION */}
              <div className="flex flex-wrap justify-end gap-3 pt-6 border-t border-gray-200">
                {selectedGroup.status === 'pending' && (
                  <button
                    onClick={() => {
                      handleUpdateGroupStatus(selectedGroup.order_group_id, 'processing');
                    }}
                    disabled={statusUpdateLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {statusUpdateLoading ? 'Mise à jour...' : 'Marquer comme préparée'}
                  </button>
                )}
                
                {selectedGroup.status === 'processing' && (
                  <button
                    onClick={() => {
                      handleUpdateGroupStatus(selectedGroup.order_group_id, 'delivered');
                    }}
                    disabled={statusUpdateLoading}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    <Truck className="w-5 h-5" />
                    {statusUpdateLoading ? 'Mise à jour...' : 'Marquer comme livrée'}
                  </button>
                )}
                
                <button
                  onClick={() => handlePrintDeliveryNote(selectedGroup)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Printer className="w-5 h-5" />
                  Bon de livraison
                </button>
                
                {selectedGroup.status !== 'cancelled' && selectedGroup.status !== 'delivered' && (
                  <button
                    onClick={() => {
                      handleUpdateGroupStatus(selectedGroup.order_group_id, 'cancelled');
                    }}
                    disabled={statusUpdateLoading}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    <X className="w-5 h-5" />
                    Annuler la commande
                  </button>
                )}
                
                <button
                  onClick={handleBackToList}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-sm border border-gray-300"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Retour à la liste
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AFFICHAGE DE LA LISTE DES COMMANDES
  return (
    <>
      <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
        
        {/* Notification nouvelle commande */}
        {newOrderAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 border-l-4 border-emerald-500">
            <BellRing className="w-5 h-5 text-emerald-600" />
            <span className="font-medium text-gray-800">Nouvelle commande reçue !</span>
            <button onClick={() => setNewOrderAlert(false)} className="ml-4 text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
              <p className="text-sm text-gray-600">{filteredGroups.length} commande{filteredGroups.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {statusOptions.map(opt => <option key={opt.value} value={opt.value} className="text-gray-800">{opt.label}</option>)}
            </select>
            <button
              onClick={fetchOrderGroups}
              disabled={loading}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-gray-700"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 uppercase font-semibold">Total CA</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(orderGroups.reduce((a, g) => a + g.total_amount, 0))}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 uppercase font-semibold">En attente</p>
            <p className="text-xl font-bold text-amber-600">{orderGroups.filter(g => g.status === 'pending').length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 uppercase font-semibold">En cours</p>
            <p className="text-xl font-bold text-blue-600">{orderGroups.filter(g => g.status === 'processing').length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 uppercase font-semibold">Livrées</p>
            <p className="text-xl font-bold text-emerald-600">{orderGroups.filter(g => g.status === 'delivered').length}</p>
          </div>
        </div>

        {/* Liste des commandes */}
        {paginatedGroups.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Aucune commande trouvée</p>
            <p className="text-sm text-gray-500 mt-1">
              {statusFilter !== 'all' ? 'Essayez de changer le filtre' : 'Les nouvelles commandes apparaîtront ici'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedGroups.map(group => {
              const status = getStatusBadge(group.status);
              const StatusIcon = status.icon;
              const clientName = group.client?.name || `Client #${String(group.client_id).slice(-4)}`;
              
              return (
                <div
                  key={group.order_group_id}
                  onClick={() => handleOpenOrderDetail(group)}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          {normalizeOrderRef(group.order_group_id)}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-gray-700">
                          <User className="w-4 h-4 text-gray-500" /> {clientName}
                        </span>
                        <span className="flex items-center gap-1 text-gray-700">
                          <Calendar className="w-4 h-4 text-gray-500" /> 
                          {new Date(group.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="flex items-center gap-1 text-gray-700">
                          <Package className="w-4 h-4 text-gray-500" /> {group.total_items} art.
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:border-l md:border-gray-200 md:pl-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-xl font-bold text-emerald-700">{formatCurrency(group.total_amount)}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-800">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-gray-700"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}


