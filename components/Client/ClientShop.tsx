'use client'

import { useState, useMemo } from 'react'
import { Product, Client } from '@/utils/supabase/types'
import {
  ShoppingCart, Package, Plus, Minus, X, Search,
  SlidersHorizontal, ChevronDown, ChevronUp, Tag,
  Layers, AlertTriangle, CheckCircle, XCircle, Filter,
  Grid3X3, List, ArrowUpDown, Printer, Trash2,
  ReceiptText, SendHorizonal, BarChart2, MapPin,
  Hash, Boxes, Truck, Droplets, CalendarClock,
  CalendarCheck, CalendarX, Info
} from 'lucide-react'

// Utilisation du type Product importé de @/utils/supabase/types

interface ClientShopProps {
  products: Product[]
  client: Client
  cart: Record<string, number>
  onAddToCart: (productId: string) => void
  onRemoveFromCart: (productId: string) => void
  onClearCart: () => void
  onGenerateSlip: () => void
  onCheckout: () => void
  formatCurrency: (value: number) => string
  loading: boolean
  showOrderSlip: boolean
  orderSlip: any
  setShowOrderSlip: (show: boolean) => void
}

type SortOption =
  | 'name-asc' | 'name-desc'
  | 'price-asc' | 'price-desc'
  | 'stock-asc' | 'stock-desc'
  | 'expiry-asc' | 'expiry-desc'
  | 'volume-asc' | 'volume-desc'

type ViewMode = 'grid' | 'list'
type StockStatus = 'all' | 'inStock' | 'lowStock' | 'outOfStock'
type ExpiryStatus = 'all' | 'valid' | 'expiringSoon' | 'expired'

// ─── Helpers ──────────────────────────────────────────────────────
const getStockStatus = (product: Product): StockStatus => {
  const qte = product.stock_quantity ?? 0
  const min = product.min_stock_level ?? 5
  if (qte <= 0) return 'outOfStock'
  if (qte <= min) return 'lowStock'
  return 'inStock'
}

const getExpiryStatus = (date?: string): ExpiryStatus => {
  if (!date) return 'valid'
  const exp = new Date(date)
  const now = new Date()
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiringSoon'
  return 'valid'
}

const formatDate = (date?: string) => {
  if (!date) return null
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const daysUntilExpiry = (date?: string) => {
  if (!date) return null
  const exp = new Date(date)
  const now = new Date()
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Config constants ─────────────────────────────────────────────
const STOCK_CONFIG = {
  inStock:    { label: 'Disponible',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', dot: 'bg-emerald-500' },
  lowStock:   { label: 'Stock limité', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-500/10',     border: 'border-amber-200 dark:border-amber-500/20',     dot: 'bg-amber-500' },
  outOfStock: { label: 'Rupture',      color: 'text-red-500 dark:text-red-400',          bg: 'bg-red-50 dark:bg-red-500/10',         border: 'border-red-200 dark:border-red-500/20',         dot: 'bg-red-500' },
}

const EXPIRY_CONFIG = {
  valid:        { label: 'Valide',          color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  expiringSoon: { label: 'Expire bientôt',  color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-500/10' },
  expired:      { label: 'Expiré',          color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-500/10' },
}

// ══════════════════════════════════════════════════════════════════
export default function ClientShop({
  products, client, cart,
  onAddToCart, onRemoveFromCart, onClearCart,
  onGenerateSlip, onCheckout, formatCurrency,
  loading, showOrderSlip, orderSlip, setShowOrderSlip
}: ClientShopProps) {

  // ── Filter states ──
  const [searchQuery,      setSearchQuery]      = useState('')
  const [stockFilter,      setStockFilter]      = useState<StockStatus>('all')
  const [expiryFilter,     setExpiryFilter]     = useState<ExpiryStatus>('all')
  const [categoryFilter,   setCategoryFilter]   = useState('all')
  const [provenanceFilter, setProvenanceFilter] = useState('all')
  const [supplierFilter,   setSupplierFilter]   = useState('all')
  const [priceMin,         setPriceMin]         = useState('')
  const [priceMax,         setPriceMax]         = useState('')
  const [volumeMin,        setVolumeMin]        = useState('')
  const [volumeMax,        setVolumeMax]        = useState('')
  const [refSearch,        setRefSearch]        = useState('')
  const [lotSearch,        setLotSearch]        = useState('')
  const [sortBy,           setSortBy]           = useState<SortOption>('name-asc')

  // ── UI states ──
  const [viewMode,         setViewMode]         = useState<ViewMode>('grid')
  const [showFilters,      setShowFilters]      = useState(false)
  const [showCart,         setShowCart]         = useState(false)
  const [expandedProduct,  setExpandedProduct]  = useState<string | null>(null)

  // ── Derived option lists ──
  const categories  = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean)))  as string[], [products])
  const provenances = useMemo(() => Array.from(new Set(products.map(p => p.provenance).filter(Boolean))) as string[], [products])
  const suppliers   = useMemo(() => Array.from(new Set(products.map(p => p.supplier).filter(Boolean)))  as string[], [products])
  const priceRange  = useMemo(() => {
    const prices = products.map(p => p.price || 0)
    return { min: Math.min(...prices, 0), max: Math.max(...prices, 0) }
  }, [products])
  const volumeRange = useMemo(() => {
    const vols = products.map(p => p.volume_ml || 0).filter(v => v > 0)
    return vols.length ? { min: Math.min(...vols), max: Math.max(...vols) } : null
  }, [products])

  // ── Cart helpers ──
  const getCartCount = () => Object.values(cart).reduce((s, q) => s + q, 0)
  const getCartTotal = () => Object.entries(cart).reduce((total, [id, qty]) => {
    const p = products.find(p => String(p.id) === String(id))
    return total + (p?.price || 0) * qty
  }, 0)
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => {
      const product = products.find(p => String(p.id) === String(id))
      return product ? { product, qty } : null
    })
    .filter(Boolean) as { product: Product; qty: number }[]

  // ── Active filter count ──
  const activeFilterCount = useMemo(() => [
    stockFilter !== 'all', expiryFilter !== 'all',
    categoryFilter !== 'all', provenanceFilter !== 'all', supplierFilter !== 'all',
    !!priceMin, !!priceMax, !!volumeMin, !!volumeMax,
    !!refSearch, !!lotSearch,
  ].filter(Boolean).length, [
    stockFilter, expiryFilter, categoryFilter, provenanceFilter, supplierFilter,
    priceMin, priceMax, volumeMin, volumeMax, refSearch, lotSearch,
  ])

  // ── Filtered + sorted products ──
  const filteredProducts = useMemo(() => {
    let result = products.filter(product => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = [product.name, product.category, product.description, product.provenance, product.supplier, product.reference_code, product.lot_number]
          .some(v => v?.toLowerCase().includes(q))
        if (!match) return false
      }
      if (categoryFilter   !== 'all' && product.category   !== categoryFilter)   return false
      if (provenanceFilter !== 'all' && product.provenance  !== provenanceFilter) return false
      if (supplierFilter   !== 'all' && product.supplier    !== supplierFilter)   return false
      if (stockFilter      !== 'all' && getStockStatus(product)               !== stockFilter)  return false
      if (expiryFilter     !== 'all' && getExpiryStatus(product.expiration_date) !== expiryFilter) return false
      if (priceMin  && product.price         < parseFloat(priceMin))  return false
      if (priceMax  && product.price         > parseFloat(priceMax))  return false
      if (volumeMin && (product.volume_ml ?? 0) < parseFloat(volumeMin)) return false
      if (volumeMax && (product.volume_ml ?? 0) > parseFloat(volumeMax)) return false
      if (refSearch && !product.reference_code?.toLowerCase().includes(refSearch.toLowerCase())) return false
      if (lotSearch && !product.lot_number?.toLowerCase().includes(lotSearch.toLowerCase()))     return false
      return true
    })

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':    return (a.name || '').localeCompare(b.name || '')
        case 'name-desc':   return (b.name || '').localeCompare(a.name || '')
        case 'price-asc':   return (a.price || 0) - (b.price || 0)
        case 'price-desc':  return (b.price || 0) - (a.price || 0)
        case 'stock-asc':   return (a.stock_quantity || 0) - (b.stock_quantity || 0)
        case 'stock-desc':  return (b.stock_quantity || 0) - (a.stock_quantity || 0)
        case 'expiry-asc':  return new Date(a.expiration_date || '9999').getTime() - new Date(b.expiration_date || '9999').getTime()
        case 'expiry-desc': return new Date(b.expiration_date || '0').getTime()    - new Date(a.expiration_date || '0').getTime()
        case 'volume-asc':  return (a.volume_ml || 0) - (b.volume_ml || 0)
        case 'volume-desc': return (b.volume_ml || 0) - (a.volume_ml || 0)
        default: return 0
      }
    })
    return result
  }, [products, searchQuery, categoryFilter, provenanceFilter, supplierFilter,
      stockFilter, expiryFilter, priceMin, priceMax, volumeMin, volumeMax,
      refSearch, lotSearch, sortBy])

  const clearAllFilters = () => {
    setSearchQuery(''); setStockFilter('all'); setExpiryFilter('all')
    setCategoryFilter('all'); setProvenanceFilter('all'); setSupplierFilter('all')
    setPriceMin(''); setPriceMax(''); setVolumeMin(''); setVolumeMax('')
    setRefSearch(''); setLotSearch('')
  }

  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#080808]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { font-family: 'DM Sans', system-ui, sans-serif; box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .scrollbar-thin::-webkit-scrollbar { width: 3px; height: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .card-lift { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease; }
        .card-lift:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
        .fade-in { animation: fi 0.25s ease both; }
        @keyframes fi { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .slide-right { animation: sr 0.3s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes sr { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        .badge-pill { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; white-space:nowrap; }
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* ══ HEADER ════════════════════════════════════════════════ */}
      <header className="no-print sticky top-0 z-50 bg-white/85 dark:bg-[#0C0C0C]/90 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
          <Package size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Catalogue</p>
          <p className="font-black text-sm sm:text-base truncate">{client.name}</p>
        </div>

        {/* quick stats — desktop */}
        <div className="hidden md:flex items-center gap-5 mr-2">
          {[
            { label: 'Produits',  val: products.length,                                                        color: 'text-slate-600 dark:text-slate-300' },
            { label: 'En stock',  val: products.filter(p => getStockStatus(p) === 'inStock').length,           color: 'text-emerald-500' },
            { label: 'Limités',   val: products.filter(p => getStockStatus(p) === 'lowStock').length,          color: 'text-amber-500' },
            { label: 'Expirés',   val: products.filter(p => getExpiryStatus(p.expiration_date) === 'expired').length, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`font-black text-sm mono ${s.color}`}>{s.val}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-3.5 py-2.5 rounded-xl font-black text-sm hover:bg-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white transition-all shadow-md"
        >
          <ShoppingCart size={15} />
          <span className="hidden sm:inline text-xs">Panier</span>
          {getCartCount() > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-white dark:ring-[#0C0C0C]">
              {getCartCount()}
            </span>
          )}
        </button>
      </header>

      {/* ══ LAYOUT ════════════════════════════════════════════════ */}
      <div className="flex">

        {/* ── FILTER SIDEBAR ──────────────────────────────────── */}
        <aside className={`
          no-print fixed inset-0 z-40 lg:relative lg:inset-auto
          lg:w-72 xl:w-80 lg:flex lg:shrink-0
          ${showFilters ? 'flex' : 'hidden'}
          flex-col
        `}>
          {/* mobile overlay */}
          <div className="lg:hidden absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFilters(false)} />

          <div className="relative z-10 w-72 lg:w-full bg-white dark:bg-[#0D0D0D] h-screen overflow-y-auto scrollbar-thin p-5 space-y-0 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] border-r border-black/5 dark:border-white/5">

            {/* Sidebar header */}
            <div className="flex items-center justify-between pb-4 mb-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-emerald-500" />
                <span className="font-black text-xs uppercase tracking-widest">Filtres avancés</span>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{activeFilterCount}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button onClick={clearAllFilters} className="text-[10px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                    <X size={11} /> Reset
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} className="lg:hidden p-1.5 rounded-lg bg-slate-100 dark:bg-white/5">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* ── Recherche globale ── */}
            <FilterSection title="Recherche" icon={Search} defaultOpen>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nom, description, fournisseur…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl text-xs outline-none focus:ring-2 ring-emerald-500/30 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={12}/>
                  </button>
                )}
              </div>
            </FilterSection>

            {/* ── Référence produit ── */}
            <FilterSection title="Référence produit" icon={Hash}>
              <input
                type="text"
                placeholder="ex: REF-0042"
                value={refSearch}
                onChange={e => setRefSearch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl text-xs mono outline-none focus:ring-2 ring-emerald-500/30 transition-all"
              />
            </FilterSection>

            {/* ── Numéro de lot ── */}
            <FilterSection title="Numéro de lot" icon={Boxes}>
              <input
                type="text"
                placeholder="ex: LOT-2024-A"
                value={lotSearch}
                onChange={e => setLotSearch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl text-xs mono outline-none focus:ring-2 ring-emerald-500/30 transition-all"
              />
            </FilterSection>

            {/* ── Catégorie ── */}
            {categories.length > 0 && (
              <FilterSection title="Catégorie" icon={Layers}>
                <div className="flex flex-wrap gap-1.5">
                  {['all', ...categories].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        categoryFilter === cat
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-transparent'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/8 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                      }`}
                    >
                      {cat === 'all' ? 'Toutes' : cat}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* ── Provenance ── */}
            {provenances.length > 0 && (
              <FilterSection title="Provenance / Origine" icon={MapPin}>
                <div className="space-y-1">
                  {['all', ...provenances].map(prov => (
                    <button
                      key={prov}
                      onClick={() => setProvenanceFilter(prov)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                        provenanceFilter === prov
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-transparent'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/8 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <MapPin size={10} className={provenanceFilter === prov ? 'opacity-60' : 'text-slate-400'} />
                      <span className="flex-1">{prov === 'all' ? 'Toutes origines' : prov}</span>
                      <span className="mono text-[10px] opacity-50">
                        {prov === 'all' ? products.length : products.filter(p => p.provenance === prov).length}
                      </span>
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* ── Fournisseur ── */}
            {suppliers.length > 0 && (
              <FilterSection title="Fournisseur" icon={Truck}>
                <div className="space-y-1">
                  {['all', ...suppliers].map(sup => (
                    <button
                      key={sup}
                      onClick={() => setSupplierFilter(sup)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                        supplierFilter === sup
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-transparent'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/8 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <Truck size={10} className={supplierFilter === sup ? 'opacity-60' : 'text-slate-400'} />
                      <span className="flex-1 truncate">{sup === 'all' ? 'Tous fournisseurs' : sup}</span>
                      <span className="mono text-[10px] opacity-50">
                        {sup === 'all' ? products.length : products.filter(p => p.supplier === sup).length}
                      </span>
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* ── Disponibilité / Stock ── */}
            <FilterSection title="Disponibilité" icon={BarChart2}>
              <div className="space-y-1.5">
                {([
                  ['all',        'Tous',         null],
                  ['inStock',    'Disponible',   'bg-emerald-500'],
                  ['lowStock',   'Stock limité', 'bg-amber-500'],
                  ['outOfStock', 'Rupture',      'bg-red-500'],
                ] as [StockStatus, string, string | null][]).map(([val, label, dot]) => (
                  <button
                    key={val}
                    onClick={() => setStockFilter(val)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      stockFilter === val
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-transparent'
                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/8 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot || 'bg-slate-300 dark:bg-white/20'}`} />
                    <span className="flex-1 text-left">{label}</span>
                    <span className="mono text-[10px] opacity-60">
                      {val === 'all' ? products.length : products.filter(p => getStockStatus(p) === val).length}
                    </span>
                  </button>
                ))}
              </div>
            </FilterSection>

            {/* ── Date d'expiration ── */}
            {products.some(p => p.expiration_date) && (
              <FilterSection title="Date d'expiration" icon={CalendarClock}>
                <div className="space-y-1.5">
                  {([
                    ['all',          'Toutes dates',    null],
                    ['valid',        'Valide',          'bg-emerald-500'],
                    ['expiringSoon', 'Expire ≤ 30j',    'bg-amber-500'],
                    ['expired',      'Expiré',          'bg-red-500'],
                  ] as [ExpiryStatus, string, string | null][]).map(([val, label, dot]) => (
                    <button
                      key={val}
                      onClick={() => setExpiryFilter(val)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                        expiryFilter === val
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-transparent'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/8 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot || 'bg-slate-300 dark:bg-white/20'}`} />
                      <span className="flex-1 text-left">{label}</span>
                      <span className="mono text-[10px] opacity-60">
                        {val === 'all' ? products.length : products.filter(p => getExpiryStatus(p.expiration_date) === val).length}
                      </span>
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* ── Fourchette de prix ── */}
            <FilterSection title="Fourchette de prix" icon={Tag}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Min</label>
                  <input
                    type="number"
                    placeholder={String(Math.floor(priceRange.min))}
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl text-xs mono outline-none focus:ring-2 ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Max</label>
                  <input
                    type="number"
                    placeholder={String(Math.ceil(priceRange.max))}
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl text-xs mono outline-none focus:ring-2 ring-emerald-500/30"
                  />
                </div>
              </div>
            </FilterSection>

            {/* ── Volume (mL) ── */}
            {volumeRange && (
              <FilterSection title="Volume (mL)" icon={Droplets}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Min mL</label>
                    <input
                      type="number"
                      placeholder={String(volumeRange.min)}
                      value={volumeMin}
                      onChange={e => setVolumeMin(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl text-xs mono outline-none focus:ring-2 ring-emerald-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Max mL</label>
                    <input
                      type="number"
                      placeholder={String(volumeRange.max)}
                      value={volumeMax}
                      onChange={e => setVolumeMax(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl text-xs mono outline-none focus:ring-2 ring-emerald-500/30"
                    />
                  </div>
                </div>
              </FilterSection>
            )}

            {/* ── Tri ── */}
            <FilterSection title="Trier par" icon={ArrowUpDown}>
              <div className="space-y-1">
                {([
                  ['name-asc',    'Nom A → Z'],
                  ['name-desc',   'Nom Z → A'],
                  ['price-asc',   'Prix croissant'],
                  ['price-desc',  'Prix décroissant'],
                  ['stock-desc',  'Plus en stock'],
                  ['stock-asc',   'Moins en stock'],
                  ['expiry-asc',  'Expire le plus tôt'],
                  ['expiry-desc', 'Expire le plus tard'],
                  ['volume-asc',  'Volume croissant'],
                  ['volume-desc', 'Volume décroissant'],
                ] as [SortOption, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      sortBy === val
                        ? 'bg-emerald-500 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FilterSection>
          </div>
        </aside>

        {/* ══ PRODUCTS AREA ═════════════════════════════════════ */}
        <main className="flex-1 min-w-0 p-4 sm:p-5 pb-32 lg:pb-10">

          {/* Toolbar */}
          <div className="no-print flex items-center gap-3 mb-4 flex-wrap">
            <button
              onClick={() => setShowFilters(true)}
              className="lg:hidden flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black hover:border-emerald-400 transition-all"
            >
              <Filter size={13} />
              Filtres
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>

            <p className="text-xs text-slate-500 flex-1 font-semibold">
              <span className="text-slate-900 dark:text-white font-black mono">{filteredProducts.length}</span> / {products.length} produits
            </p>

            <div className="hidden sm:flex bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-1 gap-1">
              {(['grid', 'list'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {mode === 'grid' ? <Grid3X3 size={14}/> : <List size={14}/>}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="no-print flex flex-wrap gap-2 mb-4 fade-in">
              {searchQuery             && <Chip label={`"${searchQuery}"`}              onRemove={() => setSearchQuery('')} />}
              {refSearch               && <Chip label={`Réf: ${refSearch}`}             onRemove={() => setRefSearch('')} />}
              {lotSearch               && <Chip label={`Lot: ${lotSearch}`}             onRemove={() => setLotSearch('')} />}
              {categoryFilter   !== 'all' && <Chip label={categoryFilter}               onRemove={() => setCategoryFilter('all')} />}
              {provenanceFilter !== 'all' && <Chip label={`📍 ${provenanceFilter}`}     onRemove={() => setProvenanceFilter('all')} />}
              {supplierFilter   !== 'all' && <Chip label={`🚚 ${supplierFilter}`}       onRemove={() => setSupplierFilter('all')} />}
              {stockFilter      !== 'all' && <Chip label={STOCK_CONFIG[stockFilter].label}   onRemove={() => setStockFilter('all')} />}
              {expiryFilter     !== 'all' && <Chip label={(EXPIRY_CONFIG as any)[expiryFilter].label} onRemove={() => setExpiryFilter('all')} />}
              {priceMin                && <Chip label={`Prix ≥ ${priceMin}`}            onRemove={() => setPriceMin('')} />}
              {priceMax                && <Chip label={`Prix ≤ ${priceMax}`}            onRemove={() => setPriceMax('')} />}
              {volumeMin               && <Chip label={`Vol. ≥ ${volumeMin} mL`}        onRemove={() => setVolumeMin('')} />}
              {volumeMax               && <Chip label={`Vol. ≤ ${volumeMax} mL`}        onRemove={() => setVolumeMax('')} />}
            </div>
          )}

          {/* Empty state */}
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center fade-in">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center mb-4 border border-slate-200 dark:border-white/8">
                <Package size={24} className="text-slate-300 dark:text-slate-600"/>
              </div>
              <p className="font-black text-slate-400">Aucun résultat</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Aucun produit ne correspond à vos filtres</p>
              <button onClick={clearAllFilters} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs hover:bg-emerald-600 transition-colors">
                Réinitialiser les filtres
              </button>
            </div>
          )}

          {/* ── GRID VIEW ── */}
          {viewMode === 'grid' && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filteredProducts.map((product, i) => {
                const qty     = cart[String(product.id)] || 0
                const status  = getStockStatus(product)
                const expStat = getExpiryStatus(product.expiration_date)
                const cfg     = (STOCK_CONFIG as any)[status] || STOCK_CONFIG.inStock
                const stock   = product.stock_quantity ?? 0
                const days    = daysUntilExpiry(product.expiration_date)
                const isOpen  = expandedProduct === String(product.id)

                return (
                  <div
                    key={product.id}
                    className="card-lift fade-in bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden flex flex-col"
                    style={{ animationDelay: `${i * 25}ms` }}
                  >
                    {/* Image */}
                    <div className="relative h-44 bg-slate-50 dark:bg-white/3 overflow-hidden">
                      {product.image_data
                        ? <img src={product.image_data} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                        : <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>
                      }
                      {/* Badges top-left */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1">
                        <span className={`badge-pill border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
                          {status === 'lowStock' ? `${stock} restants` : cfg.label}
                        </span>
                        {product.expiration_date && expStat !== 'valid' && (
                          <span className={`badge-pill ${(EXPIRY_CONFIG as any)[expStat].bg} ${(EXPIRY_CONFIG as any)[expStat].color}`}>
                            {expStat === 'expired' ? 'Expiré' : `Exp. dans ${days}j`}
                          </span>
                        )}
                      </div>
                      {/* Cart qty badge */}
                      {qty > 0 && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#111]">
                          {qty}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-4 flex flex-col flex-1 gap-2">
                      {product.category && (
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{product.category}</p>
                      )}
                      <h3 className="font-black text-sm leading-snug line-clamp-2">{product.name}</h3>

                      {/* Meta pills row */}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {product.provenance && (
                          <span className="badge-pill bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            <MapPin size={9}/> {product.provenance}
                          </span>
                        )}
                        {product.volume_ml && (
                          <span className="badge-pill bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Droplets size={9}/> {product.volume_ml} mL
                          </span>
                        )}
                        {product.reference_code && (
                          <span className="badge-pill bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 mono">
                            {product.reference_code}
                          </span>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedProduct(isOpen ? null : String(product.id))}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-emerald-500 transition-colors self-start"
                      >
                        <Info size={10}/> {isOpen ? 'Moins' : 'Détails'}
                        {isOpen ? <ChevronUp size={9}/> : <ChevronDown size={9}/>}
                      </button>

                      {/* Expanded details panel */}
                      {isOpen && (
                        <div className="fade-in bg-slate-50 dark:bg-white/3 rounded-xl p-3 space-y-2 text-[11px] border border-slate-100 dark:border-white/5">
                          {product.description && (
                            <p className="text-slate-500 leading-relaxed">{product.description}</p>
                          )}
                          {[
                            [Truck,        'Fournisseur',  product.supplier],
                            [MapPin,       'Provenance',   product.provenance],
                            [Hash,         'Référence',    product.reference_code],
                            [Boxes,        'N° de lot',    product.lot_number],
                            [Droplets,     'Volume',       product.volume_ml ? `${product.volume_ml} mL` : null],
                            [CalendarClock,'Expiration',   formatDate(product.expiration_date)],
                          ].filter(([,, v]) => v).map(([IconComp, label, value], idx) => {
                            const Icon = IconComp as any;
                            return (
                              <div key={idx} className="flex items-center gap-2 text-slate-500">
                                <Icon size={10} className="text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-400 shrink-0">{label as string} :</span>
                                <span className={`font-semibold mono truncate ${
                                  label === 'Expiration' && expStat === 'expired' ? 'text-red-500' :
                                  label === 'Expiration' && expStat === 'expiringSoon' ? 'text-amber-500' : ''
                                }`}>{value as string}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-2">
                        <p className="text-emerald-500 font-black text-lg mono">{formatCurrency(product.price)}</p>
                        {product.supplier && !isOpen && (
                          <p className="text-[10px] font-bold text-slate-400 truncate max-w-[90px]">{product.supplier}</p>
                        )}
                      </div>

                      {/* CTA */}
                      {status === 'outOfStock' ? (
                        <div className="py-2.5 bg-slate-100 dark:bg-white/5 rounded-xl text-[10px] font-black text-slate-400 text-center uppercase tracking-widest">Épuisé</div>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 rounded-xl p-1">
                          <button
                            onClick={() => onRemoveFromCart(String(product.id))}
                            className="flex-1 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#0E0E0E] border border-slate-100 dark:border-white/8 hover:border-red-300 hover:text-red-500 transition-all"
                          >
                            <Minus size={13}/>
                          </button>
                          <span className="w-10 text-center font-black text-sm mono">{qty}</span>
                          <button
                            onClick={() => onAddToCart(String(product.id))}
                            disabled={qty >= stock}
                            className="flex-1 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#0E0E0E] border border-slate-100 dark:border-white/8 hover:border-emerald-300 hover:text-emerald-500 disabled:opacity-30 transition-all"
                          >
                            <Plus size={13}/>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            onAddToCart(String(product.id));
                            if (navigator.vibrate) navigator.vibrate(50);
                          }}
                          className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white active:scale-[0.98] transition-all shadow-lg shadow-slate-900/10 dark:shadow-none"
                        >
                          Ajouter au panier
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && filteredProducts.length > 0 && (
            <div className="space-y-2">
              {filteredProducts.map((product, i) => {
                const qty     = cart[String(product.id)] || 0
                const status  = getStockStatus(product)
                const expStat = getExpiryStatus(product.expiration_date)
                const cfg     = (STOCK_CONFIG as any)[status] || STOCK_CONFIG.inStock
                const stock   = product.stock_quantity ?? 0
                const days    = daysUntilExpiry(product.expiration_date)

                return (
                  <div
                    key={product.id}
                    className="fade-in bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-4"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 shrink-0">
                      {product.image_data
                        ? <img src={product.image_data} alt={product.name} className="w-full h-full object-cover"/>
                        : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      {product.category && <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{product.category}</p>}
                      <p className="font-black text-sm truncate">{product.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`badge-pill border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
                        </span>
                        {product.provenance && (
                          <span className="badge-pill bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            <MapPin size={9}/>{product.provenance}
                          </span>
                        )}
                        {product.supplier && (
                          <span className="badge-pill bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            <Truck size={9}/>{product.supplier}
                          </span>
                        )}
                        {product.reference_code && (
                          <span className="badge-pill bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 mono">
                            {product.reference_code}
                          </span>
                        )}
                        {product.lot_number && (
                          <span className="badge-pill bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 mono">
                            Lot: {product.lot_number}
                          </span>
                        )}
                        {product.volume_ml && (
                          <span className="badge-pill bg-blue-50 dark:bg-blue-500/10 text-blue-600">
                            <Droplets size={9}/>{product.volume_ml} mL
                          </span>
                        )}
                        {product.expiration_date && expStat !== 'valid' && (
                          <span className={`badge-pill ${(EXPIRY_CONFIG as any)[expStat].bg} ${(EXPIRY_CONFIG as any)[expStat].color}`}>
                            {expStat === 'expired' ? 'Expiré' : `Exp. dans ${days}j`}
                          </span>
                        )}
                        {product.expiration_date && expStat === 'valid' && (
                          <span className="badge-pill bg-slate-100 dark:bg-white/5 text-slate-400">
                            <CalendarCheck size={9}/>{formatDate(product.expiration_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <p className="text-emerald-500 font-black text-sm mono">{formatCurrency(product.price)}</p>
                      {status === 'outOfStock' ? (
                        <span className="text-[10px] font-bold text-slate-400">Épuisé</span>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 rounded-xl p-1">
                          <button onClick={() => onRemoveFromCart(String(product.id))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-black border border-slate-100 dark:border-white/8 hover:text-red-500 transition-colors"><Minus size={12}/></button>
                          <span className="w-6 text-center font-black text-sm mono">{qty}</span>
                          <button onClick={() => onAddToCart(String(product.id))} disabled={qty >= stock} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-black border border-slate-100 dark:border-white/8 hover:text-emerald-500 disabled:opacity-30 transition-colors"><Plus size={12}/></button>
                        </div>
                      ) : (
                        <button onClick={() => onAddToCart(String(product.id))} className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-[10px] uppercase hover:bg-emerald-500 transition-all">+</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* ══ CART DRAWER ══════════════════════════════════════════ */}
      {showCart && (
        <div className="no-print fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)}/>
          <div className="relative ml-auto w-full max-w-md h-full bg-white dark:bg-[#0E0E0E] flex flex-col slide-right shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-black text-base uppercase">Mon Panier</h3>
                <p className="text-[10px] text-slate-400 font-semibold">{getCartCount()} article{getCartCount() !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5"><X size={15}/></button>
            </div>

            {cartItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <ShoppingCart size={28} className="text-slate-300 dark:text-slate-600"/>
                <p className="font-bold text-slate-400 text-sm">Panier vide</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2.5">
                  {cartItems.map(({ product, qty }) => (
                    <div key={product.id} className="flex items-center gap-3 bg-slate-50 dark:bg-white/5 rounded-2xl p-3">
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 shrink-0">
                        {product.image_data
                          ? <img src={product.image_data} alt={product.name} className="w-full h-full object-cover"/>
                          : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs truncate">{product.name}</p>
                        {product.reference_code && <p className="text-[10px] text-slate-400 mono">{product.reference_code}</p>}
                        {product.lot_number     && <p className="text-[10px] text-slate-400 mono">Lot: {product.lot_number}</p>}
                        <p className="text-emerald-500 font-black text-xs mono">{formatCurrency(product.price * qty)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => onRemoveFromCart(String(product.id))} className="w-7 h-7 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-white/8 flex items-center justify-center hover:text-red-500 transition-colors"><Minus size={11}/></button>
                        <span className="w-6 text-center font-black text-xs mono">{qty}</span>
                        <button onClick={() => onAddToCart(String(product.id))} disabled={qty >= (product.stock_quantity ?? 0)} className="w-7 h-7 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-white/8 flex items-center justify-center hover:text-emerald-500 disabled:opacity-30 transition-colors"><Plus size={11}/></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</span>
                    <span className="text-xl font-black text-emerald-500 mono">{formatCurrency(getCartTotal())}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={onClearCart} className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                      <Trash2 size={16}/>
                    </button>
                    <button
                      onClick={() => { onGenerateSlip(); setShowCart(false) }}
                      className="flex-1 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white transition-all"
                    >
                      <ReceiptText size={14}/> Générer le bon
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ MOBILE CART FAB ══════════════════════════════════════ */}
      {getCartCount() > 0 && !showCart && (
        <div className="no-print lg:hidden fixed bottom-6 inset-x-4 z-[100]">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between bg-slate-900 dark:bg-white text-white dark:text-black px-5 py-3.5 rounded-2xl font-black text-sm shadow-2xl shadow-black/25 hover:bg-emerald-500 transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={16}/>
              <span>{getCartCount()} article{getCartCount() !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-emerald-400 dark:text-emerald-500 mono">{formatCurrency(getCartTotal())}</span>
          </button>
        </div>
      )}

      {/* ══ ORDER SLIP MODAL ════════════════════════════════════ */}
      {showOrderSlip && orderSlip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; }
              .print-area { box-shadow: none !important; border: none !important; width: 100% !important; max-height: none !important; overflow: visible !important; }
            }
          `}</style>
          <div className="bg-white dark:bg-[#0E0E0E] rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin shadow-2xl slide-right print-area">
            <div className="no-print p-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ReceiptText size={16} className="text-emerald-500"/>
                </div>
                <div>
                  <h2 className="font-black text-base">Bon de Commande</h2>
                  <p className="text-[10px] text-slate-400 mono">{orderSlip.id}</p>
                </div>
              </div>
              <button onClick={() => setShowOrderSlip(false)} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5"><X size={15}/></button>
            </div>

            <div className="p-7 space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</p>
                  <p className="font-black text-xl">{client.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                  <p className="text-sm font-bold">{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-white/3">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Article</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Qté</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {orderSlip.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-bold text-sm">{item.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-sm mono">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-black text-sm mono">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl p-4 flex items-center justify-between">
                <span className="font-bold text-[10px] uppercase tracking-widest opacity-60">Total de la commande</span>
                <span className="font-black text-2xl mono">{formatCurrency(orderSlip.total)}</span>
              </div>

              <div className="no-print flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                >
                  <Printer size={14}/> Imprimer
                </button>
                <button
                  onClick={onCheckout}
                  disabled={loading}
                  className="flex-[1.5] py-3.5 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-60 transition-all"
                >
                  {loading
                    ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"/>Traitement…</>
                    : <><SendHorizonal size={14}/> Confirmer &amp; Envoyer</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────
function FilterSection({
  title, icon: Icon, children, defaultOpen = false
}: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-100 dark:border-white/5 pb-4 pt-3 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between mb-3 group">
        <div className="flex items-center gap-2">
          <Icon size={12} className="text-slate-400 group-hover:text-emerald-500 transition-colors"/>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
            {title}
          </span>
        </div>
        {open ? <ChevronUp size={12} className="text-slate-300"/> : <ChevronDown size={12} className="text-slate-300"/>}
      </button>
      {open && <div className="fade-in">{children}</div>}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg text-[10px] font-bold">
      {label}
      <button onClick={onRemove} className="opacity-50 hover:opacity-100 transition-opacity"><X size={10}/></button>
    </span>
  )
}