'use client'

import { useState, useEffect, useMemo } from 'react'
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

import { loadTemplate, renderTemplate } from '@/components/Merchant/templateLoader'
import { numberToWordsDA } from '@/components/Merchant/numberToWords'

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
  total_tax?: number;
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

  const productLookup = useMemo(() => {
    const map = new Map<string, any>()
    products.forEach(product => {
      if (product?.id === undefined || product?.id === null) return
      map.set(String(product.id), product)
    })
    return map
  }, [products])

  const resolveOrderLine = (order: any, lookup: Map<string, any> = productLookup) => {
    const product = lookup.get(String(order.product_id)) || null
    const quantity = Math.max(0, Number(order.quantity ?? 1))
    const unitPrice = Number(product?.price ?? order.price ?? order.unit_price ?? 0)
    const vatCandidate = Number(product?.tva_rate ?? order.tva_rate ?? order.tax_rate ?? 0)
    const hasTva = Boolean(
      order.has_tva ?? product?.has_tva ?? vatCandidate > 0
    )
    const tvaRate = hasTva ? Math.max(0, vatCandidate) : 0
    const lineTotal = quantity * unitPrice
    const taxAmount = hasTva && tvaRate > 0 ? (lineTotal * tvaRate) / 100 : 0
    return {
      product,
      quantity,
      unitPrice,
      hasTva,
      tvaRate,
      lineTotal,
      taxAmount,
    }
  }

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
          total_tax: 0,
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
        let totalInclTax = 0
        let totalTax = 0
        group.orders.forEach(order => {
          const { lineTotal, taxAmount } = resolveOrderLine(order)
          totalInclTax += lineTotal + taxAmount
          totalTax += taxAmount
        })
        group.total_amount = totalInclTax
        group.total_tax = totalTax
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
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    try {
      new Notification(title, {
        body: message,
      })
    } catch (e) {
      console.warn('Erreur native notification:', e)
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
      const { product, quantity, unitPrice, hasTva, tvaRate, lineTotal, taxAmount } = resolveOrderLine(order)
      const reference =
        order.reference ||
        order.product_reference ||
        product?.reference_code ||
        product?.ref ||
        `PRD-${String(order.product_id || order.id || 0).slice(-4)}`
      const name = product?.name || order.product_name || `Produit ${String(order.product_id || order.id || '').slice(-6)}`
      const familyValue =
        typeof product?.family === 'string' && product.family.trim()
          ? product.family.trim()
          : order.family || ''
      const lotValue =
        order.lot ||
        order.lot_number ||
        order.batch ||
        order.batch_number ||
        product?.lot_number ||
        ''
      return {
        name,
        reference,
        family: familyValue,
        lot: lotValue,
        price: unitPrice,
        quantity,
        has_tva: hasTva,
        tva_rate: hasTva ? tvaRate : 0,
        line_total: lineTotal,
        tax_amount: taxAmount,
      }
    })

    const totalHT = items.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0)
    const totalTax = items.reduce((sum: number, item: any) => sum + (item.tax_amount || 0), 0)
    const totalTTC = totalHT + totalTax
    const computedTvaRate = totalHT ? Number(((totalTax / totalHT) * 100).toFixed(2)) : 0

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
      tva_rate: computedTvaRate,
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

    const companyName = companyInfo?.company_name || companyInfo?.name || 'Entreprise'
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
    const invoiceTvaStatus =
      tvaRate <= 0 ? 'Non assujetti à la TVA' : 'TVA collectée sur cette facture'

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
                <div style="margin-top:10px; font-size:12px; color:var(--muted); font-weight:800;">${invoiceTvaStatus}</div>
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

  const safeValue = (value: any) => {
    if (value === undefined || value === null || value === '') {
      return '—'
    }
    return escapeHtml(String(value))
  }

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

    const clientName = group.client?.name || 'Médecin'
    const clientEmail = group.client?.email || ''
    const clientPhone = group.client?.phone || ''
    const clientAddress = group.client?.address || ''
    const clientCity = group.client?.city || ''

    const items = Array.isArray(invoice?.items) ? invoice.items : []
    const totalHT = Number(invoice?.total_ht ?? 0)
    const tvaRate = Number(invoice?.tva_rate ?? 0)
    const tvaAmount = totalHT * (tvaRate / 100)
    const totalTTC = Number(invoice?.total_ttc ?? totalHT + tvaAmount)
    const invoiceTvaStatus = tvaRate <= 0 ? 'Non assujetti à la TVA' : 'TVA collectée sur cette facture'

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
                <div style="margin-top:10px;font-size:12px;color:#64748b;font-weight:800;">${invoiceTvaStatus}</div>
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

    const clientName = clientInfo?.name || group.client?.name || 'Médecin'
    const clientEmail = clientInfo?.email || group.client?.email || ''
    const clientPhone = clientInfo?.phone || group.client?.phone || ''
    const clientAddress = clientInfo?.address || group.client?.address || ''
    const clientCity = clientInfo?.city || group.client?.city || ''

    const rowEntries = (group.orders || []).map((order: any) => {
      const { product, quantity, lineTotal, taxAmount } = resolveOrderLine(order)
      const name = escapeHtml(product?.name || `Produit ${String(order.product_id || order.id || '').slice(-6)}`)
      const qty = quantity
      const priceValue = Number(product?.price ?? 0)
      const priceLabel = formatCurrencyBL(priceValue).trim()
      const lineLabel = formatCurrencyBL(lineTotal).trim()
      return {
        html: `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0;">${name}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${qty}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right;">${priceLabel}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700;">${lineLabel}</td>
          </tr>
        `,
        lineTotal,
        taxAmount,
      }
    })
    const rows = rowEntries.map(entry => entry.html).join('')
    const totalHT = rowEntries.reduce((sum, row) => sum + (row.lineTotal || 0), 0)
    const totalTax = rowEntries.reduce((sum, row) => sum + (row.taxAmount || 0), 0)
    const totalTTC = totalHT + totalTax
    const tvaStatus = totalTax <= 0 ? 'Non assujetti à la TVA' : 'TVA collectée sur cette livraison'

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
                <div style="display:flex;justify-content:space-between;font-weight:900;"><span>Total HT</span><span style="color:#4f46e5;">${formatCurrencyBL(totalHT).trim()}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-top:6px;"><span>TVA</span><span>${formatCurrencyBL(totalTax).trim()}</span></div>
                <div style="display:flex;justify-content:space-between;font-weight:900;margin-top:6px;"><span>Total TTC</span><span style="color:#0f172a;">${formatCurrencyBL(totalTTC).trim()}</span></div>
                <div style="margin-top:10px;font-size:12px;color:#64748b;font-weight:800;">${tvaStatus}</div>
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
                clientName: group.client?.name || 'Médecin',
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
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .maybeSingle()

      if (merchantError) console.warn('Impossible de récupérer le marchand pour le BL:', merchantError)

      const clientRequest = group.client_id
        ? supabase.from('clients').select('*').eq('id', group.client_id).maybeSingle()
        : Promise.resolve({ data: null, error: null })

      const { data: client, error: clientError } = await clientRequest
      if (clientError) console.warn('Impossible de récupérer le client pour le BL:', clientError)

      const clientInfo = client || group.client || {}
      const merchantInfo = merchant || {}
      const template = await loadTemplate('delivery')
      const formatter = new Intl.NumberFormat('fr-DZ', {
        style: 'currency',
        currency: 'DZD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
      const orderLines = Array.isArray(group.orders) ? group.orders : []
        let totalHT = 0
        let totalTax = 0
        let totalQty = 0
        const vatRates = new Set<number>()

      const rows = orderLines
        .map(order => {
          const { product, quantity, lineTotal, taxAmount } = resolveOrderLine(order)
          totalQty += quantity
          totalHT += lineTotal
          totalTax += taxAmount
          const safeName = escapeHtml(product?.name || order.name || 'Produit')
          const safeReferenceCode = safeValue(product?.reference_code || product?.ref || order.reference_code)
          const safeFamily = safeValue(product?.family || order.family)
          const safeLot = safeValue(product?.lot_number || order.lot_number || product?.lot_number)
          const safeVolume = safeValue(product?.volume_ml || order.volume_ml)
          const safeDescription = safeValue(product?.description || order.description)
          const safeProvenance = safeValue(product?.provenance || order.provenance)
          const safeSupplier = safeValue(product?.supplier || order.supplier)
          const safeExpiration = safeValue(product?.expiration_date || order.expiration_date)
          const safeStockQty = safeValue(product?.stock_quantity)
          const safeMinStock = safeValue(product?.min_stock_level)
          const safeCreatedAt = safeValue(product?.created_at || order.created_at)
          const safeUpdatedAt = safeValue(product?.updated_at || order.updated_at)
          const safeActive = product?.active === false ? 'Non' : 'Oui'
          const hasProductTva = Boolean(product?.has_tva ?? order.has_tva)
          const tvaRate = hasProductTva
            ? Number(product?.tva_rate ?? order.tva_rate ?? order.tax_rate ?? 0)
            : 0

          const detailFields = [
            { label: 'ID', value: safeValue(product?.id) },
            { label: 'Marchand', value: safeValue(product?.merchant_id) },
            { label: 'Description', value: safeDescription },
            { label: 'Famille', value: safeFamily },
            { label: 'Lot', value: safeLot },
            { label: 'Référence', value: safeReferenceCode },
            { label: 'TVA', value: hasProductTva ? `Oui (${tvaRate.toFixed(2)}%)` : 'Non' },
            { label: 'Expiration', value: safeExpiration },
            { label: 'Volume', value: safeVolume },
            { label: 'Stock', value: safeStockQty },
            { label: 'Stock mini', value: safeMinStock },
            { label: 'Créé le', value: safeCreatedAt },
            { label: 'Mis à jour', value: safeUpdatedAt },
            { label: 'Actif', value: safeActive },
            { label: 'Provenance', value: safeProvenance },
            { label: 'Fournisseur', value: safeSupplier },
          ]

          const filteredDetails = detailFields.filter(field => field.value !== '—')
          const detailsHtml =
            filteredDetails
              .map(field => `<span class="meta-tag"><strong>${field.label}:</strong> ${field.value}</span>`)
              .join('') || '<span class="meta-tag">Détails non renseignés</span>'

          return `
            <tr>
              <td><strong>${safeName}</strong></td>
              <td>${safeReferenceCode}</td>
              <td>${safeFamily}</td>
              <td>${safeLot}</td>
              <td>${safeVolume}</td>
              <td class="qty-cell">${quantity}</td>
            </tr>
            <tr class="product-details-row">
              <td colspan="6">
                <div class="product-meta">
                  ${detailsHtml}
                </div>
              </td>
            </tr>
          `
        })
        .join('')

      const rowsHtml = rows || '<tr><td colspan="6" class="text-right">Aucune ligne</td></tr>'
      const totalTTC = totalHT + totalTax
      const vatRateLabel = vatRates.size === 1 ? `${Array.from(vatRates)[0].toFixed(2)}` : 'Mixte'
      const vatStatusText = totalTax > 0 ? 'TVA collectée sur cette livraison' : 'Non assujetti à la TVA'
      const amountInWords = numberToWordsDA(totalTTC)
      const deliveryDate = group.created_at ? new Date(group.created_at) : new Date()
      const formattedDate = deliveryDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const normalizedRef = normalizeOrderRef(group.order_group_id)
      const dateSuffix = formattedDate.replace(/\//g, '')
      const deliveryNumber = `BL-${normalizedRef}-${dateSuffix}`
      const fiscalPieces = [
        merchantInfo?.nif ? `NIF: ${escapeHtml(String(merchantInfo.nif))}` : null,
        merchantInfo?.rc ? `RC: ${escapeHtml(String(merchantInfo.rc))}` : null,
        merchantInfo?.ai ? `AI: ${escapeHtml(String(merchantInfo.ai))}` : null,
        merchantInfo?.nis ? `NIS: ${escapeHtml(String(merchantInfo.nis))}` : null
      ]
        .filter(Boolean)
        .join(' • ') || 'Fiscalité non renseignée'

      const companyAddress = [
        merchantInfo?.adresse_de_l_entreprise,
        merchantInfo?.company_address,
        merchantInfo?.address
      ]
        .filter(Boolean)
        .map(value => escapeHtml(String(value)))
        .join(', ')

      const companyContact = [
        merchantInfo?.company_phone || merchantInfo?.telephone || merchantInfo?.phone,
        merchantInfo?.company_email || merchantInfo?.email
      ]
        .filter(Boolean)
        .map(value => escapeHtml(String(value)))
        .join(' • ')

      const medicalAddress = [
        clientInfo?.address || clientInfo?.adresse,
        clientInfo?.city || clientInfo?.ville,
        clientInfo?.wilaya
      ]
        .filter(Boolean)
        .map(value => escapeHtml(String(value)))
        .join(', ')

      const replacements: Record<string, string> = {
        COMPANY_NAME: escapeHtml(merchantInfo?.nom || merchantInfo?.company_name || 'DiagnoSphère'),
        COMPANY_ADDRESS: escapeHtml(companyAddress || '—'),
        COMPANY_CONTACT: companyContact,
        COMPANY_EMAIL: escapeHtml(merchantInfo?.company_email || merchantInfo?.email || ''),
        FISCAL_INFO: fiscalPieces,
        DELIVERY_NUMBER: escapeHtml(deliveryNumber),
        ORDER_REF: escapeHtml(normalizedRef),
        REFERENCE_NUMBER: escapeHtml(group.order_group_id || ''),
        DELIVERY_DATE: escapeHtml(formattedDate),
        MEDICAL_PROFESSIONAL: escapeHtml(clientInfo?.nom || clientInfo?.name || 'Médecin'),
        MEDICAL_ADDRESS: medicalAddress,
        MEDICAL_PHONE: escapeHtml(clientInfo?.telephone || clientInfo?.phone || ''),
        MEDICAL_EMAIL: escapeHtml(clientInfo?.email || ''),
        DELIVERY_MODE: escapeHtml(group.delivery_mode || 'Standard'),
        DELIVERY_TRANSPORTER: escapeHtml(group.transporter || group.transporteur || 'Logistique interne'),
        OBSERVATIONS: escapeHtml(group.notes || 'Aucune observation'),
        SENDER_LABEL: escapeHtml('DiagnoSphère'),
        SENDER_NAME: escapeHtml(merchantInfo?.nom || merchantInfo?.company_name || 'DiagnoSphere'),
        SENDER_SIGNATURES: escapeHtml('Visa Logistique (Sortie) • Visa Client (Réception)'),
        DOCUMENT_NOTE: escapeHtml('Ce document atteste le transfert de marchandise, sans valeur monétaire affichée'),
        DELIVERY_ROWS: rowsHtml,
        TOTAL_HT: formatter.format(totalHT),
        TOTAL_QUANTITY: String(totalQty),
        VAT_RATE: vatRateLabel,
        VAT_AMOUNT: formatter.format(totalTax),
        TOTAL_TTC: formatter.format(totalTTC),
        VAT_STATUS_TEXT: vatStatusText,
        AMOUNT_IN_WORDS: escapeHtml(amountInWords),
        TOTAL_DELIVERED: formatter.format(totalTTC),
        SIGNATURE_DELIVERER: 'Signature livreur',
        SIGNATURE_RECEIVER: 'Signature destinataire'
      }

      const htmlContent = renderTemplate(template, replacements)
      const printWindow = window.open('', '_blank', 'width=1000,height=720')
      if (!printWindow) {
        alert('Veuillez autoriser les popups')
        return
      }
      printWindow.document.write(htmlContent)
      printWindow.document.close()

      if (sendDocsByEmail) void sendDeliveryNoteEmail(group, clientInfo, deliveryNumber, formattedDate)
    } catch (error) {
      console.error('Erreur lors de la génération du bon de livraison:', error)
      alert('Erreur lors de la génération du bon de livraison')
    }
  }

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
                      {selectedGroup.client?.name || 'Médecin'}
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


