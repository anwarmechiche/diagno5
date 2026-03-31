'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase' 
import Modal from '@/components/ui/Modal'
import { LayoutDashboard, Users, MapPin, Phone, Mail, FileText, Printer, Send, CheckCircle, Clock, Calendar, DollarSign, Package, CreditCard, Building2, FileSignature, Building, Receipt, Tag, CalendarDays, Timer, Banknote, Globe, Briefcase, Shield, Award } from 'lucide-react'
import { motion } from 'framer-motion'
import { loadTemplate, renderTemplate } from '@/components/Merchant/templateLoader'
import { numberToWordsDA } from '@/components/Merchant/numberToWords'

// Type local étendu pour inclure les données du client
interface Invoice {
  id: string
  invoice_number: string
  client_id: number
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
  order_group_id?: string
  created_at: string
  updated_at: string
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

  const fetchData = async () => {
    if (!merchantId) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })

      if (error) throw error
      const invoiceList = Array.isArray(data) ? data : []
      const clientIds = Array.from(
        new Set(invoiceList.map(inv => inv.client_id).filter((id): id is number => typeof id === 'number'))
      )
      let clientsMap: Record<number, any> = {}
      if (clientIds.length) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id,name,phone,email,city,address')
          .in('id', clientIds)
        if (!clientsError && Array.isArray(clientsData)) {
          clientsMap = Object.fromEntries(clientsData.map(client => [client.id, client]))
        }
      }
      setInvoices(
        invoiceList.map(inv => ({
          ...inv,
          clients: inv.clients || clientsMap[Number(inv.client_id)] || null
        }))
      )
    } catch (err: any) {
      console.error('Erreur chargement factures:', err)
      setErrorMsg(err?.message || 'Impossible de charger les factures')
    } finally {
      setLoading(false)
    }
  }

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

  const escapeHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const openInvoicePrintWindow = async (invoice: Invoice | null) => {
    if (!invoice || typeof window === 'undefined') return

    try {
      const template = await loadTemplate('invoice')
      const items = Array.isArray(invoice.items) ? invoice.items : []
      const formatter = new Intl.NumberFormat('fr-DZ', {
        style: 'currency',
        currency: 'DZD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
      let totalHT = 0
      let totalTax = 0
      const vatRates = new Set<number>()

      const rows = items
        .map((item) => {
          const quantity = Number(item.quantity || 1)
          const price = Number(item.price || item.unit_price || 0)
          const rate = Number(item.tva_rate ?? item.tax_rate ?? 0)
          const lineTotal = quantity * price
          const taxAmount = (lineTotal * rate) / 100
          totalHT += lineTotal
          totalTax += taxAmount
          vatRates.add(rate)
          const safeName = escapeHtml(item.name || item.designation || 'Produit')
          const safeFamily = escapeHtml(item.family || item.category || 'General')
          return `
            <tr>
              <td>${safeName}</td>
              <td class="family">${safeFamily}</td>
              <td class="text-right">${quantity}</td>
              <td class="text-right">${formatter.format(price)}</td>
              <td class="text-right">${rate.toFixed(2)}</td>
              <td class="text-right">${formatter.format(lineTotal)}</td>
            </tr>
          `
        })
        .join('')
      const rowsHtml = rows || '<tr><td colspan="6" class="text-center">Aucun article</td></tr>'
      const totalTTC = totalHT + totalTax
      const vatRateLabel = vatRates.size === 1 ? `${Array.from(vatRates)[0].toFixed(2)}` : 'Mixte'
      const vatStatusText = totalTax > 0 ? 'TVA collectée sur cette facture' : 'Non assujetti à la TVA'
      const amountInWords = numberToWordsDA(totalTTC)
      const invoiceDate = invoice.date || invoice.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
      const dueDate = invoice.due_date || invoiceDate
      const orderRef = normalizeOrderRef(String(invoice.order_group_id || ''))
      const companyName = companyInfo?.company_name || companyInfo?.name || 'Entreprise'
      const companyAddress = [
        companyInfo?.company_address,
        companyInfo?.address,
        companyInfo?.adresse_de_l_entreprise
      ]
        .filter(Boolean)
        .map(value => escapeHtml(String(value)))
        .join(', ')
      const companyContact = [
        companyInfo?.company_phone || companyInfo?.phone || '',
        companyInfo?.company_email || companyInfo?.email || ''
      ]
        .filter(Boolean)
        .map(value => escapeHtml(String(value)))
        .join(' • ')
      const fiscalPieces = [
        companyInfo?.nif ? `NIF: ${escapeHtml(String(companyInfo.nif))}` : null,
        companyInfo?.rc ? `RC: ${escapeHtml(String(companyInfo.rc))}` : null,
        companyInfo?.ai ? `AI: ${escapeHtml(String(companyInfo.ai))}` : null,
        companyInfo?.nis ? `NIS: ${escapeHtml(String(companyInfo.nis))}` : null
      ]
        .filter(Boolean)
        .join(' • ') || 'Fiscalité non renseignée'
      const client = invoice.clients || {}
      const clientAddress = [
        client.address,
        client.city
      ]
        .filter(Boolean)
        .map(value => escapeHtml(String(value)))
        .join(', ')
      const notesHtml = invoice.notes
        ? escapeHtml(invoice.notes).replace(/\n/g, '<br/>')
        : 'Facture générée automatiquement.'
      const statusLabels: Record<string, string> = {
        draft: 'Brouillon',
        pending: 'En attente',
        paid: 'Payée',
        cancelled: 'Annulée'
      }
      const documentStatus = statusLabels[invoice.status] || 'En attente'
      const replacements: Record<string, string> = {
        COMPANY_NAME: escapeHtml(companyName),
        COMPANY_ADDRESS: escapeHtml(companyAddress || '—'),
        COMPANY_CONTACT: companyContact,
        COMPANY_EMAIL: escapeHtml(companyInfo?.company_email || companyInfo?.email || ''),
        FISCAL_INFO: fiscalPieces,
        INVOICE_NUMBER: escapeHtml(invoice.invoice_number || `INV-${String(invoice.id).slice(0, 8)}`),
        INVOICE_DATE: escapeHtml(invoiceDate),
        INVOICE_DUE_DATE: escapeHtml(dueDate),
        ORDER_REF: escapeHtml(orderRef),
        PAYMENT_METHOD: escapeHtml(invoice.payment_method || 'À déterminer'),
        DOCUMENT_STATUS: escapeHtml(documentStatus),
        CLIENT_NAME: escapeHtml(client.name || 'Médecin'),
        CLIENT_ADDRESS: clientAddress,
        CLIENT_PHONE: escapeHtml(client.phone || ''),
        CLIENT_EMAIL: escapeHtml(client.email || ''),
        DELIVERY_DATE: escapeHtml(invoice.delivery_date || invoiceDate),
        ITEM_ROWS: rowsHtml,
        TOTAL_HT: formatter.format(totalHT),
        VAT_RATE: vatRateLabel,
        VAT_AMOUNT: formatter.format(totalTax),
        TOTAL_TTC: formatter.format(totalTTC),
        VAT_STATUS_TEXT: vatStatusText,
        AMOUNT_IN_WORDS: escapeHtml(amountInWords),
        NOTES: notesHtml,
        SIGNATURE_CLIENT: 'Signature médecin',
        SIGNATURE_COMPANY: 'Signature fournisseur'
      }
      const htmlContent = renderTemplate(template, replacements)
      const printWindow = window.open('', '_blank', 'width=1000,height=720')
      if (!printWindow) {
        alert('Veuillez autoriser les popups')
        return
      }
      printWindow.document.write(htmlContent)
      printWindow.document.close()
    } catch (error) {
      console.error('Erreur lors de la génération de la facture:', error)
      alert('Erreur lors de la génération de la facture')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (value?: string) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: 'Brouillon' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock, label: 'En attente' },
      paid: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Payée' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: Clock, label: 'Annulée' }
    }
    const s = config[status] || config.draft
    const Icon = s.icon
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {s.label}
      </span>
    )
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

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003366] mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement des factures...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className={`flex ${hideHeader ? 'justify-end' : 'justify-between'} items-center gap-4 flex-wrap`}>
        {!hideHeader && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Facturation</h1>
            <p className="text-gray-500 mt-1">Gérez vos factures et suivez les paiements</p>
          </div>
        )}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Rechercher par numéro ou médecin..." 
            className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl w-80 outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Facture</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Médecin</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Aucune facture trouvée</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-[#003366]">{inv.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{inv.clients?.name || 'Non spécifié'}</div>
                      {inv.clients?.phone && (
                        <div className="text-xs text-gray-400 mt-0.5">{inv.clients.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(inv.date)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-gray-900">{formatCurrency(inv.total_ht || inv.total_ttc || 0)}</span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setSelectedInvoice(inv); setViewInvoiceModalOpen(true); }}
                        className="text-sm font-medium text-[#003366] hover:text-[#002244] transition-colors"
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
      </div>

      <Modal 
        isOpen={viewInvoiceModalOpen} 
        onClose={() => setViewInvoiceModalOpen(false)} 
        title=""
        size="xl"
      >
        {selectedInvoice && (
          <div className="text-gray-900">
            <div className="border-b border-gray-200 pb-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#003366] to-[#002244] rounded-xl flex items-center justify-center shadow-lg">
                      <FileSignature className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#003366] uppercase tracking-wider">Facture</p>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedInvoice.invoice_number}</h2>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-1">ID: {selectedInvoice.id.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(selectedInvoice.status)}
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Total TTC</p>
                    <p className="text-2xl font-bold text-[#003366]">{formatCurrency(selectedInvoice.total_ht || selectedInvoice.total_ttc || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Informations médecin</h3>
                </div>
                <div className="space-y-3">
                  <p className="font-bold text-gray-900 text-lg">{selectedInvoice.clients?.name || 'Non spécifié'}</p>
                  {selectedInvoice.clients?.address && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <span>{selectedInvoice.clients.address}{selectedInvoice.clients?.city ? `, ${selectedInvoice.clients.city}` : ''}</span>
                    </div>
                  )}
                  {selectedInvoice.clients?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${selectedInvoice.clients.phone}`} className="text-blue-600 hover:underline">
                        {selectedInvoice.clients.phone}
                      </a>
                    </div>
                  )}
                  {selectedInvoice.clients?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${selectedInvoice.clients.email}`} className="text-blue-600 hover:underline">
                        {selectedInvoice.clients.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Détails facture</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-500">Date d'émission</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{formatDate(selectedInvoice.date)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-500">Date d'échéance</span>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-red-600">{formatDate(selectedInvoice.due_date)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-500">Réf commande</span>
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {normalizeOrderRef(String(selectedInvoice.order_group_id || ''))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500">Mode de paiement</span>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 uppercase">
                        {selectedInvoice.payment_method || 'Non défini'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Articles</h3>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {selectedInvoice.items?.length || 0} article(s)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 rounded-lg">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Article</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix unitaire</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(!selectedInvoice.items || selectedInvoice.items.length === 0) ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                          Aucun article dans cette facture
                        </td>
                      </tr>
                    ) : (
                      selectedInvoice.items.map((item: any, index: number) => {
                        const quantity = Number(item?.quantity || 0)
                        const price = Number(item?.price || 0)
                        const total = quantity * price
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{item?.name || 'Produit'}</div>
                              {item?.description && (
                                <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{quantity}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(price)}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(total)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {selectedInvoice.notes && (
                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">Observations</span>
                  </div>
                  <p className="text-sm text-gray-700">{selectedInvoice.notes}</p>
                </div>
              )}
              <div className={`${selectedInvoice.notes ? '' : 'lg:col-start-2'} bg-gray-50 rounded-xl p-5`}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total HT</span>
                    <span className="text-sm font-medium text-gray-700">{formatCurrency(selectedInvoice.total_ht || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">TVA ({selectedInvoice.tva_rate || 0}%)</span>
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(((selectedInvoice.total_ht || 0) * (selectedInvoice.tva_rate || 0)) / 100)}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold text-gray-900">Total TTC</span>
                      <span className="text-xl font-bold text-[#003366]">
                        {formatCurrency(selectedInvoice.total_ht || selectedInvoice.total_ttc || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-right">
                      {numberToWordsDA(selectedInvoice.total_ht || selectedInvoice.total_ttc || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-400 font-mono">
                ID système: {selectedInvoice.id}
              </div>
              <div className="flex gap-3">
                {selectedInvoice.status !== 'paid' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                    className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Valider le paiement
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={emailSending}
                  onClick={() => sendInvoiceByEmail(selectedInvoice)}
                  className="px-5 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-xl shadow-md hover:bg-gray-900 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {emailSending ? 'Envoi...' : 'Envoyer par email'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void openInvoicePrintWindow(selectedInvoice)}
                  className="px-5 py-2.5 bg-[#003366] text-white text-sm font-semibold rounded-xl shadow-md hover:bg-[#002244] transition-all flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
