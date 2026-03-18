'use client'

import { useState, useEffect, useMemo } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ProductForm from '@/components/Merchant/ProductForm'
import ClientForm from '@/components/Merchant/ClientForm'
import OrdersPage from '@/components/Merchant/OrdersPage'
import InvoicesListPage from '@/components/Merchant/InvoicesListPage'
import NotificationsTab from '@/components/Merchant/NotificationsTab'
import StockManager from '@/components/Merchant/StockManager'
import StatBI from '@/components/Merchant/StatBI'
import { db } from '@/utils/supabase/client'
import { supabase } from '@/lib/supabase'
import MerchantSettingsTab from '@/components/Merchant/MerchantSettingsTab'
import EmailsTab from '@/components/Merchant/EmailsTab'
import { AnimatePresence, motion } from 'framer-motion'
import { Product, Client, Order } from '@/utils/supabase/types'
import {
  Plus,
  Eye,
  Edit2,
  Trash2,
  BellRing,
  Boxes,
  FileText,
  LayoutDashboard,
  Mail,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react'
interface MerchantDashboardProps {
  merchantId: string
  user: any
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export default function MerchantDashboard({
  merchantId,
  user,
  activeTab: activeTabProp,
  onTabChange,
}: MerchantDashboardProps) {
  const [activeTab, setActiveTab] = useState(activeTabProp || 'dashboard')
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    products: 0,
    clients: 0,
    orders: 0,
    revenue: 0
  })

  // États pour les modales
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [viewProductModalOpen, setViewProductModalOpen] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [viewClientModalOpen, setViewClientModalOpen] = useState(false)
  const [statBIModalOpen, setStatBIModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  // États pour les notifications
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [showOrderToast, setShowOrderToast] = useState(false)
  const [latestOrderInfo, setLatestOrderInfo] = useState<{id: string, clientName: string} | null>(null)

  // Smart product filter state
  const [productSearch, setProductSearch] = useState('')
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [productPriceMin, setProductPriceMin] = useState('')
  const [productPriceMax, setProductPriceMax] = useState('')
  const [productProvenance, setProductProvenance] = useState('')
  const [productLot, setProductLot] = useState('')
  const [productRef, setProductRef] = useState('')
  const [productSupplier, setProductSupplier] = useState('')
  const [productVolume, setProductVolume] = useState('')
  const [productFilterOpen, setProductFilterOpen] = useState(false)
  const [productViewMode, setProductViewMode] = useState<'table' | 'grid'>('table')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [clientSearch, setClientSearch] = useState('')

  useEffect(() => {
    if (merchantId) {
      loadData()
    }
  }, [merchantId])

  useEffect(() => {
    if (!activeTabProp) return
    setActiveTab(activeTabProp)
  }, [activeTabProp])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const TAB_EVENT = 'merchant:tab'
    const onTab = (event: Event) => {
      const custom = event as CustomEvent<{ tabId?: string }>
      const tabId = String(custom?.detail?.tabId || '').trim()
      if (!tabId) return
      setActiveTab(tabId)
      if (typeof onTabChange === 'function') onTabChange(tabId)
    }
    window.addEventListener(TAB_EVENT, onTab)
    return () => window.removeEventListener(TAB_EVENT, onTab)
  }, [onTabChange])

  // REAL-TIME NOTIFICATIONS (SHARED)
  useEffect(() => {
    if (!merchantId) return

    // 1. Initial count of unread notifications
    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .eq('read', false)
        
        if (!error && count !== null) setUnreadNotifications(count)
      } catch (e) {
        console.warn('Erreur count notifications:', e)
      }
    }
    fetchUnreadCount()

    // 2. Browser permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const showNotif = (title: string, body: string) => {
      // Sound ping + Vibration (Tactile feedback)
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
        audio.play().catch(() => {})
        
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100])
        }
      } catch (e) {
        console.warn('Feedback error:', e)
      }

      // Native browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' })
      }
    }


    // 3. Subscribe to NEW ORDERS (Messenger-like)
    const channel = supabase
      .channel(`merchant-global-${merchantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `merchant_id=eq.${merchantId}`
      }, (payload) => {
        // Déclencher alerte
        setLatestOrderInfo({
          id: String(payload.new.order_group_id || payload.new.id).slice(-8),
          clientName: 'Nouvelle commande' 
        })
        setShowOrderToast(true)
        showNotif('Nouvelle Commande !', 'Vous avez reçu une nouvelle commande.')
        setUnreadNotifications(prev => prev + 1)
        loadData() // Actualiser les graphiques/stats
        setTimeout(() => setShowOrderToast(false), 8000)
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `merchant_id=eq.${merchantId}`
      }, () => {
        setUnreadNotifications(prev => prev + 1)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel).catch(console.error)
    }
  }, [merchantId])

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('Chargement des données pour merchantId:', merchantId)
      
      const [productsData, clientsData, ordersData] = await Promise.all([
        db.getProducts(merchantId),
        db.getClients(merchantId),
        db.getOrders(merchantId)
      ])

      console.log('Données récupérées:', {
        produits: productsData.length,
        clients: clientsData.length,
        commandes: ordersData.length
      })

      setProducts(productsData)
      setClients(clientsData)
      setOrders(ordersData)

      // Calculate stats
      const revenue = ordersData.reduce((total, order) => {
        const product = productsData.find(p => p.id === order.product_id)
        return total + (order.quantity * (product?.price || 0))
      }, 0)

      setStats({
        products: productsData.length,
        clients: clientsData.length,
        orders: ordersData.length,
        revenue
      })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(value)
  }

  // Fonctions pour les produits
  const handleViewProduct = async (productId: string) => {
    try {
      console.log('Visualisation produit ID:', productId)
      const product = await db.getProductById(productId)
      if (product) {
        setSelectedProduct(product)
        setViewProductModalOpen(true)
      } else {
        alert('Produit non trouvé')
      }
    } catch (error) {
      console.error('Error viewing product:', error)
      alert('Erreur lors du chargement du produit')
    }
  }

  const handleEditProduct = async (productId: string) => {
    try {
      console.log('Édition produit ID:', productId)
      const product = await db.getProductById(productId)
      if (product) {
        setSelectedProduct(product)
        setProductModalOpen(true)
      } else {
        alert('Produit non trouvé')
      }
    } catch (error) {
      console.error('Error editing product:', error)
      alert('Erreur lors du chargement du produit')
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        const success = await db.deleteProduct(productId)
        if (success) {
          alert('Produit supprimé avec succès')
          await loadData() // Recharger les données
        } else {
          alert('Erreur lors de la suppression du produit')
        }
      } catch (error) {
        console.error('Error deleting product:', error)
        alert('Erreur lors de la suppression du produit')
      }
    }
  }

  const handleProductSubmit = async (productData: Partial<Product>) => {
    try {
      let result: Product | null = null
      if (selectedProduct) {
        // Mise à jour
        result = await db.updateProduct(selectedProduct.id, productData)
        if (result) {
          alert('Produit mis à jour avec succès')
        }
      } else {
        // Création
        result = await db.createProduct({
          ...productData,
          merchant_id: merchantId
        } as any)
        if (result) {
          alert('Produit créé avec succès')
        }
      }
      
      if (result) {
        setProductModalOpen(false)
        setSelectedProduct(null)
        await loadData() // Recharger les données
      } else {
        alert('Erreur lors de l\'enregistrement du produit')
      }
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Erreur lors de l\'enregistrement du produit')
      throw error
    }
  }

  // Fonctions pour les clients
  const handleViewClient = async (clientId: string) => {
    try {
      console.log('Visualisation client ID:', clientId)
      const client = await db.getClientById(clientId)
      if (client) {
        setSelectedClient(client)
        setViewClientModalOpen(true)
      } else {
        alert('Client non trouvé')
      }
    } catch (error) {
      console.error('Error viewing client:', error)
      alert('Erreur lors du chargement du client')
    }
  }

  const handleEditClient = async (clientId: string) => {
    try {
      console.log('Édition client ID:', clientId)
      const client = await db.getClientById(clientId)
      if (client) {
        setSelectedClient(client)
        setClientModalOpen(true)
      } else {
        alert('Client non trouvé')
      }
    } catch (error) {
      console.error('Error editing client:', error)
      alert('Erreur lors du chargement du client')
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      try {
        // Créez cette fonction dans votre db si elle n'existe pas
        // const success = await db.deleteClient(clientId)
        // Pour l'instant, on va juste simuler
        alert('Fonction de suppression à implémenter')
        await loadData() // Recharger les données
      } catch (error) {
        console.error('Error deleting client:', error)
        alert('Erreur lors de la suppression du client')
      }
    }
  }

  const handleClientSubmit = async (clientData: Partial<Client>) => {
    try {
      if (selectedClient) {
        // Mise à jour
        const result = await db.updateClient(selectedClient.id, clientData)
        if (result) {
          alert('Client mis à jour avec succès')
          setClientModalOpen(false)
          setSelectedClient(null)
          await loadData() // Recharger les données
        }
      } else {
        // Création - vous devrez implémenter createClient dans db
        alert('Fonction de création de client à implémenter')
      }
    } catch (error) {
      console.error('Error saving client:', error)
      alert('Erreur lors de l\'enregistrement du client')
      throw error
    }
  }

  // Unique values for intelligent filters
  const filterOptions = useMemo(() => {
    const provs = new Set<string>()
    const lots = new Set<string>()
    const supps = new Set<string>()
    const vols = new Set<string>()

    products.forEach(p => {
      if (p.provenance) provs.add(p.provenance)
      if (p.lot_number) lots.add(p.lot_number)
      if (p.supplier) supps.add(p.supplier)
      if (p.volume_ml) vols.add(p.volume_ml.toString())
    })

    return {
      provenance: Array.from(provs).sort(),
      lot: Array.from(lots).sort(),
      supplier: Array.from(supps).sort(),
      volume: Array.from(vols).sort((a,b) => Number(a) - Number(b))
    }
  }, [products])

  // Filtered products (smart filters)
  const filteredProducts = products.filter(p => {
    const nameMatch = productSearch === '' || (p.name || '').toLowerCase().includes(productSearch.toLowerCase())
    const minMatch = productPriceMin === '' || (p.price || 0) >= Number(productPriceMin)
    const maxMatch = productPriceMax === '' || (p.price || 0) <= Number(productPriceMax)
    
    // new advanced filters
    const provMatch = productProvenance === '' || (p.provenance || '').toLowerCase() === productProvenance.toLowerCase() || (p.provenance || '').toLowerCase().includes(productProvenance.toLowerCase())
    const lotMatch = productLot === '' || (p.lot_number || '').toLowerCase() === productLot.toLowerCase() || (p.lot_number || '').toLowerCase().includes(productLot.toLowerCase())
    const refMatch = productRef === '' || (p.ref || p.reference_code || p.id || '').toLowerCase().includes(productRef.toLowerCase())
    const suppMatch = productSupplier === '' || (p.supplier || '').toLowerCase() === productSupplier.toLowerCase() || (p.supplier || '').toLowerCase().includes(productSupplier.toLowerCase())
    const volumeMatch = productVolume === '' || (p.volume_ml ?? '').toString() === productVolume

    const stock = Number((p as any).stock_quantity ?? 0)
    const min = Number((p as any).min_stock_level ?? 0)
    const stockMatch =
      productStockFilter === 'all' ? true :
      productStockFilter === 'in_stock' ? stock > (min || 5) :
      productStockFilter === 'low_stock' ? (stock > 0 && stock <= (min || 5)) :
      stock === 0
    return nameMatch && minMatch && maxMatch && stockMatch && provMatch && lotMatch && refMatch && suppMatch && volumeMatch
  })

  // Filtered clients (search)
  const filteredClients = clients.filter(c => {
    return clientSearch === '' ||
      (c.name || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(clientSearch.toLowerCase())
  })

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const selectAllProducts = () => {
    setSelectedProductIds(filteredProducts.length === selectedProductIds.length ? [] : filteredProducts.map(p => p.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-[#f5f5f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#e0d4db] border-t-[#714B67] rounded-full animate-spin" />
          <p className="text-[#6B6B6B] text-sm font-medium">Chargement des données...</p>
        </div>
      </div>
    )
  }

  /* ===================== Odoo-Style RENDER ===================== */
  const odooNavTabs = [
    { id: 'dashboard', label: 'Vue Générale', Icon: LayoutDashboard },
    { id: 'products', label: 'Anticorps & IVD', Icon: Package },
    { id: 'clients', label: 'Laboratoires', Icon: Users },
    { id: 'orders', label: 'Commandes', Icon: ShoppingCart },
    { id: 'invoices', label: 'Facturation', Icon: FileText },
    { id: 'notifications', label: 'Alertes', Icon: BellRing },
    { id: 'emails', label: 'Messages', Icon: Mail },
    { id: 'stock', label: 'Inventaire', Icon: Boxes },
    { id: 'settings', label: 'Paramètres', Icon: Settings },
  ]

  // Reset notifications when clicking terminal or alerts tab
  const handleTabClick = (id: string) => {
    setActiveTab(id)
    if (id === 'notifications') {
      setUnreadNotifications(0)
    }
    if (typeof window !== 'undefined') window.localStorage.setItem('merchant_active_tab', id)
    if (typeof onTabChange === 'function') onTabChange(id)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B]">
      {/* Premium Glassmorphism Top Bar */}
      <div className="sticky top-0 z-50 bg-[#714B67]/80 backdrop-blur-xl text-white px-4 sm:px-8 py-4 flex items-center justify-between shadow-xl shadow-[#714B67]/5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ rotate: -10, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="white" className="drop-shadow-sm"/>
            </svg>
          </motion.div>
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-tight leading-none">DIAGNOSPHÈRE</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mt-1">Espace Importateur Premium</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStatBIModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-white/10 to-white/20 hover:from-white/20 hover:to-white/30 border border-white/20 transition-all px-5 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95"
          >
            <i className="fas fa-chart-pie text-teal-300"></i>
            <span className="hidden sm:block">STATISTIQUES BI</span>
          </button>
          
          <div className="hidden md:flex items-center gap-3 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
            <div className="relative">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full block" />
              <span className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
            </div>
            <span className="text-xs font-bold tracking-wide uppercase opacity-90">{user?.name || 'Admin'}</span>
          </div>
        </div>
      </div>

      {/* Advanced KPI Cards with Gradients & Depth */}
      <div className="px-4 sm:px-8 pt-6 pb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Anticorps & IVD', value: stats.products, sub: 'Catalogue Médical', icon: 'fa-vial', gradient: 'from-fuchsia-500 to-purple-600', color: '#714B67' },
            { label: 'Laboratoires', value: stats.clients, sub: 'Structures Actives', icon: 'fa-microscope', gradient: 'from-cyan-500 to-blue-600', color: '#1F7E9A' },
            { label: 'Commandes', value: stats.orders, sub: 'Flux Mensuel', icon: 'fa-box-open', gradient: 'from-emerald-400 to-teal-600', color: '#28A745' },
            { label: 'Chiffre d\'Affaires', value: stats.revenue, isCurrency: true, sub: 'Croissance Globale', icon: 'fa-chart-line', gradient: 'from-amber-400 to-orange-600', color: '#F39C12' },
          ].map((kpi, i) => (
            <motion.div 
              key={i} 
              whileHover={{ y: -5 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-xl transition-all h-full relative overflow-hidden group"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${kpi.gradient} opacity-[0.03] -mr-8 -mt-8 rounded-full group-hover:opacity-[0.07] transition-opacity`} />
              
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg shadow-current/20`}>
                  <i className={`fas ${kpi.icon} text-white text-xl`}></i>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">{kpi.label}</div>
                  <div className="text-[10px] text-slate-400 hidden sm:block">{kpi.sub}</div>
                </div>
              </div>
              
              <div className="flex items-baseline gap-1">
                <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                  {kpi.isCurrency ? formatCurrency(kpi.value as number) : kpi.value}
                </div>
                {!kpi.isCurrency && <span className="text-xs font-bold text-slate-400">unités</span>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Odoo-style tab navigation - Enhanced */}
      <div className="px-4 sm:px-8 mt-6 border-b border-slate-200 bg-white/70 backdrop-blur-xl sticky top-[72px] z-40">
        <div className="overflow-x-auto hide-scrollbar">
          <style dangerouslySetInnerHTML={{__html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}} />
          <div className="flex min-w-max gap-2">
            {odooNavTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => handleTabClick(id)}
                className={`flex items-center gap-2.5 px-5 py-4 text-xs sm:text-sm font-bold border-b-2 transition-all duration-300 whitespace-nowrap relative group ${
                  activeTab === id
                    ? 'border-[#714B67] text-[#714B67]'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${activeTab === id ? 'text-[#714B67]' : 'text-slate-400'}`} />
                {label}
                {id === 'notifications' && unreadNotifications > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-lg ring-2 ring-white animate-bounce ml-1">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 sm:px-8 py-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.99, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.01, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-8 sm:p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#f5f0f3] rounded-2xl flex items-center justify-center">
              <i className="fas fa-microscope text-2xl text-[#714B67]"></i>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2C2C2C] mb-2">Bienvenue sur DIAGNOSPHÈRE</h2>
            <p className="text-[#6B6B6B] text-sm max-w-md mx-auto">Sélectionnez un module dans la barre de navigation pour gérer vos opérations d'anatomopathologie.</p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              {odooNavTabs.slice(1).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); if (typeof onTabChange === 'function') onTabChange(id) }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#f5f0f3] text-[#714B67] rounded-lg text-sm font-medium hover:bg-[#e8dde5] transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ======== PRODUCTS TAB - Odoo style with Smart Filters ======== */}
        {activeTab === 'products' && (
          <div>
            {/* Toolbar */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm mb-6 p-4">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedProduct(null); setProductModalOpen(true) }}
                    className="flex items-center gap-2 bg-[#714B67] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#5a3a52] transition-all shadow-lg shadow-[#714B67]/20 border border-white/10"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Nouveau Produit</span>
                  </motion.button>
                  {selectedProductIds.length > 0 && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-xs font-black text-[#714B67] bg-[#f5f0f3] px-3 py-1.5 rounded-lg border border-[#e9d5e2]">
                      {selectedProductIds.length} SÉLECTIONNÉ(S)
                    </motion.div>
                  )}
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-3 w-full">
                  {/* Search */}
                  <div className="relative flex-1 group">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs group-focus-within:text-[#714B67] transition-colors"></i>
                    <input
                      type="text"
                      placeholder="Rechercher un anticorps, une référence..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#714B67]/5 focus:border-[#714B67] bg-slate-50/50 transition-all font-medium"
                    />
                    {productSearch && (
                      <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                        <i className="fas fa-times text-[10px]"></i>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 w-full md:w-auto">
                    {/* Filter toggle */}
                    <button
                      onClick={() => setProductFilterOpen(v => !v)}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border uppercase tracking-widest transition-all ${
                        productFilterOpen || productStockFilter !== 'all' || productPriceMin || productPriceMax || productProvenance || productLot || productRef || productSupplier || productVolume
                          ? 'bg-[#f5f0f3] text-[#714B67] border-[#714B67]'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 shadow-sm'
                      }`}
                    >
                      <i className="fas fa-sliders-h"></i>
                      <span>Filtres</span>
                      {(productStockFilter !== 'all' || productPriceMin || productPriceMax || productProvenance || productLot || productRef || productSupplier || productVolume) && (
                        <span className="w-2 h-2 bg-[#714B67] rounded-full animate-pulse"></span>
                      )}
                    </button>

                    {/* View mode */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setProductViewMode('table')}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${ productViewMode === 'table' ? 'bg-white text-[#714B67] shadow-sm' : 'text-slate-400 hover:text-slate-600' }`}
                        title="Vue tableau"
                      >
                        <i className="fas fa-list-ul"></i>
                      </button>
                      <button
                        onClick={() => setProductViewMode('grid')}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${ productViewMode === 'grid' ? 'bg-white text-[#714B67] shadow-sm' : 'text-slate-400 hover:text-slate-600' }`}
                        title="Vue grille"
                      >
                        <i className="fas fa-th-large"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable smart filter panel (Odoo-style sidebar filters) */}
              {productFilterOpen && (
                <div className="p-4 bg-[#FAFAFA] border-b border-[#F0F0F0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Stock status */}
                  <div>
                    <label className="block text-xs font-bold text-[#6B6B6B] uppercase tracking-wider mb-2">Disponibilité</label>
                    <div className="flex flex-col gap-1">
                      {[
                        { val: 'all', label: 'Tous les produits', dot: '#9B9B9B' },
                        { val: 'in_stock', label: 'En stock', dot: '#28A745' },
                        { val: 'low_stock', label: 'Stock faible', dot: '#F39C12' },
                        { val: 'out_of_stock', label: 'Rupture de stock', dot: '#DC3545' },
                      ].map(opt => (
                        <label key={opt.val} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white rounded-lg px-2 py-1 transition-colors">
                          <input
                            type="radio"
                            name="stock_filter"
                            value={opt.val}
                            checked={productStockFilter === (opt.val as any)}
                            onChange={() => setProductStockFilter(opt.val as any)}
                            className="accent-[#714B67]"
                          />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.dot }}></span>
                          <span className="text-[#2C2C2C] font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Price range */}
                  <div>
                    <label className="block text-xs font-bold text-[#6B6B6B] uppercase tracking-wider mb-2">Fourchette de Prix (DZD)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        placeholder="Min"
                        value={productPriceMin}
                        onChange={e => setProductPriceMin(e.target.value)}
                        className="flex-1 w-full border border-[#D9D9D9] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#714B67]"
                      />
                      <span className="text-[#9B9B9B] text-sm">—</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={productPriceMax}
                        onChange={e => setProductPriceMax(e.target.value)}
                        className="flex-1 w-full border border-[#D9D9D9] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#714B67]"
                      />
                    </div>
                  </div>

                  {/* Advanced Spec Filters */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">Provenance</label>
                      <input 
                        type="text" 
                        list="prov-list"
                        placeholder="Pays, marque..." 
                        value={productProvenance} 
                        onChange={e => setProductProvenance(e.target.value)} 
                        className="w-full border border-[#D9D9D9] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#714B67]" 
                      />
                      <datalist id="prov-list">
                        {filterOptions.provenance.map(opt => <option key={opt} value={opt} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">Fournisseur</label>
                      <input 
                        type="text" 
                        list="supp-list"
                        placeholder="Nom du fournisseur..." 
                        value={productSupplier} 
                        onChange={e => setProductSupplier(e.target.value)} 
                        className="w-full border border-[#D9D9D9] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#714B67]" 
                      />
                      <datalist id="supp-list">
                        {filterOptions.supplier.map(opt => <option key={opt} value={opt} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">N° Lot</label>
                          <input 
                            type="text" 
                            list="lot-list"
                            placeholder="Lot..." 
                            value={productLot} 
                            onChange={e => setProductLot(e.target.value)} 
                            className="w-full border border-[#D9D9D9] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#714B67]" 
                          />
                          <datalist id="lot-list">
                            {filterOptions.lot.map(opt => <option key={opt} value={opt} />)}
                          </datalist>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">Vol. (ml)</label>
                          <input 
                            type="text" 
                            list="vol-list"
                            placeholder="Vol..." 
                            value={productVolume} 
                            onChange={e => setProductVolume(e.target.value)} 
                            className="w-full border border-[#D9D9D9] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#714B67]" 
                          />
                          <datalist id="vol-list">
                            {filterOptions.volume.map(opt => <option key={opt} value={opt} />)}
                          </datalist>
                        </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">Référence (REF)</label>
                      <input type="text" placeholder="REF interne ou ID..." value={productRef} onChange={e => setProductRef(e.target.value)} className="w-full border border-[#D9D9D9] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#714B67]" />
                    </div>
                  </div>

                  {/* Reset */}
                  <div className="flex flex-col justify-end xl:col-start-4">
                    <button
                      onClick={() => { 
                        setProductSearch(''); setProductStockFilter('all'); setProductPriceMin(''); setProductPriceMax('');
                        setProductProvenance(''); setProductLot(''); setProductRef(''); setProductSupplier(''); setProductVolume('');
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#D9D9D9] text-[#6B6B6B] rounded-lg text-sm font-medium hover:border-[#DC3545] hover:text-[#DC3545] transition-colors shadow-sm"
                    >
                      <i className="fas fa-undo"></i>
                      Réinitialiser les filtres
                    </button>
                  </div>
                </div>
              )}

              {/* Results count & Applied Filters Summary */}
              <div className="px-4 py-2 flex flex-wrap items-center gap-3 border-b border-[#F0F0F0] bg-[#FAFAFA]">
                <div className="text-xs text-[#9B9B9B] font-medium mr-2">
                  {filteredProducts.length} résultat(s)
                </div>
                
                {/* Active Filter Badges */}
                <div className="flex flex-wrap gap-2">
                  {productSearch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f5f0f3] text-[#714B67] text-[10px] font-bold rounded border border-[#e9d5e2]">
                      Recherche: {productSearch}
                      <i className="fas fa-times cursor-pointer hover:text-[#DC3545]" onClick={() => setProductSearch('')}></i>
                    </span>
                  )}
                  {productProvenance && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-[#6B6B6B] text-[10px] font-bold rounded border border-[#D9D9D9]">
                      Provenance: {productProvenance}
                      <i className="fas fa-times cursor-pointer hover:text-[#DC3545]" onClick={() => setProductProvenance('')}></i>
                    </span>
                  )}
                  {productLot && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-[#6B6B6B] text-[10px] font-bold rounded border border-[#D9D9D9]">
                      Lot: {productLot}
                      <i className="fas fa-times cursor-pointer hover:text-[#DC3545]" onClick={() => setProductLot('')}></i>
                    </span>
                  )}
                  {productSupplier && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-[#6B6B6B] text-[10px] font-bold rounded border border-[#D9D9D9]">
                      Source: {productSupplier}
                      <i className="fas fa-times cursor-pointer hover:text-[#DC3545]" onClick={() => setProductSupplier('')}></i>
                    </span>
                  )}
                  {productStockFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f0faf3] text-[#28A745] text-[10px] font-bold rounded border border-[#c3e6cb]">
                      Stock: {productStockFilter === 'in_stock' ? 'En stock' : productStockFilter === 'low_stock' ? 'Bas' : 'Épuisé'}
                      <i className="fas fa-times cursor-pointer hover:text-[#DC3545]" onClick={() => setProductStockFilter('all')}></i>
                    </span>
                  )}
                </div>

                {(productSearch || productStockFilter !== 'all' || productProvenance || productLot || productSupplier || productRef || productVolume || productPriceMin || productPriceMax) && (
                  <button 
                    onClick={() => {
                      setProductSearch(''); setProductStockFilter('all'); setProductPriceMin(''); setProductPriceMax('');
                      setProductProvenance(''); setProductLot(''); setProductRef(''); setProductSupplier(''); setProductVolume('');
                    }}
                    className="ml-auto text-[10px] font-bold text-[#DC3545] hover:underline uppercase tracking-tighter"
                  >
                    Tout effacer
                  </button>
                )}
              </div>
            </div>

            {/* Products Grid View */}
            {productViewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                  const stock = Number((product as any).stock_quantity ?? 0)
                  const isLow = stock > 0 && stock <= 5
                  const isOut = stock === 0
                  
                  return (
                    <div key={product.id} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group flex flex-col">
                      <div className="p-4 flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${product.provenance ? 'bg-[#f0f7fa]' : 'bg-[#f5f0f3]'}`}>
                            <i className={`fas ${product.provenance ? 'fa-globe-africa text-[#1F7E9A]' : 'fa-vial text-[#714B67]'} text-sm`}></i>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleSelectProduct(product.id)} className="accent-[#714B67]" />
                            {product.provenance && (
                              <span className="text-[9px] font-bold text-[#6B6B6B] uppercase bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{product.provenance}</span>
                            )}
                          </div>
                        </div>
                        
                        <h3 className="font-bold text-[#2C2C2C] text-sm leading-tight mb-1 line-clamp-2 h-9">{product.name}</h3>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <code className="text-[10px] text-[#9B9B9B] font-mono bg-gray-50 px-1.5 py-0.5 rounded">{String(product.id ?? '').slice(-6)}</code>
                          {product.lot_number && (
                            <span className="text-[9px] text-[#6B6B6B] flex items-center gap-1">
                              <i className="fas fa-barcode text-[8px]"></i> {product.lot_number}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#F5F5F5]">
                          <span className="text-base font-black text-[#714B67]">{formatCurrency(product.price)}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                            isOut ? 'bg-red-50 text-red-600 border-red-100' : 
                            isLow ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-[#f0faf3] text-[#28A745] border-[#c3e6cb]'
                          }`}>
                            {isOut ? 'ÉPUISÉ' : isLow ? 'STOCK BAS' : 'DISPONIBLE'}
                          </span>
                        </div>
                      </div>
                      <div className="px-3 py-2 bg-[#FAFAFA] border-t border-[#F0F0F0] flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleViewProduct(product.id); }} className="flex-1 text-center py-1.5 text-[10px] text-[#6B6B6B] hover:text-[#714B67] font-bold transition-colors border border-transparent hover:border-[#D9D9D9] rounded-md"><i className="fas fa-eye mr-1"></i>DÉTAILS</button>
                        <button onClick={(e) => { e.stopPropagation(); handleEditProduct(product.id); }} className="flex-1 text-center py-1.5 text-[10px] text-[#6B6B6B] hover:text-[#1F7E9A] font-bold transition-colors border border-transparent hover:border-[#D9D9D9] rounded-md"><i className="fas fa-edit mr-1"></i>ÉDITER</button>
                      </div>
                    </div>
                  )
                })}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full text-center py-16 text-[#9B9B9B]">
                    <i className="fas fa-search text-3xl mb-3"></i>
                    <p className="font-medium">Aucun produit trouvé</p>
                    <p className="text-sm mt-1">Essayez de modifier vos critères de filtre</p>
                  </div>
                )}
              </div>
            )}

            {/* Products Table View (Odoo-style) */}
            {productViewMode === 'table' && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                        <th className="w-10 px-4 py-3">
                          <input type="checkbox" checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length} onChange={selectAllProducts} className="accent-[#714B67]" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Dispositif / Anticorps</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Référence</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Prix Unitaire</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Stock</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Statut</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F0]">
                      {filteredProducts.map((product, idx) => (
                        <tr
                          key={product.id}
                          className={`hover:bg-[#FBF9FA] transition-colors cursor-pointer ${ selectedProductIds.includes(product.id) ? 'bg-[#f5f0f3]' : idx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white' }`}
                          onClick={() => toggleSelectProduct(product.id)}
                        >
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleSelectProduct(product.id)} className="accent-[#714B67]" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#f5f0f3] rounded-lg flex items-center justify-center shrink-0">
                                <i className="fas fa-vial text-[#714B67] text-xs"></i>
                              </div>
                              <span className="font-semibold text-[#2C2C2C]">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-[11px] font-mono text-[#6B6B6B] bg-[#F5F5F5] px-2 py-0.5 rounded">{String(product.id ?? '').slice(-8)}</code>
                          </td>
                          <td className="px-4 py-3 font-bold text-[#714B67]">{formatCurrency(product.price)}</td>
                          <td className="px-4 py-3">
                            <span className="text-[#6B6B6B]">{(product as any).stock_quantity ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f0faf3] text-[#28A745] text-[11px] font-bold rounded-full border border-[#c3e6cb]">
                              <span className="w-1.5 h-1.5 bg-[#28A745] rounded-full"></span>
                              En stock
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2 justify-end">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleViewProduct(product.id)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100/50 dark:bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors border border-transparent hover:border-emerald-500/20"
                                title="Voir"
                              >
                                <Eye className="h-4 w-4" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleEditProduct(product.id)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100/50 dark:bg-white/5 hover:bg-blue-500/10 hover:text-blue-500 transition-colors border border-transparent hover:border-blue-500/20"
                                title="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDeleteProduct(product.id)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100/50 dark:bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 transition-colors border border-transparent hover:border-rose-500/20"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </motion.button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-16 text-center">
                            <div className="text-[#9B9B9B]">
                              <i className="fas fa-search text-3xl mb-3"></i>
                              <p className="font-medium text-base">Aucun produit trouvé</p>
                              <p className="text-sm mt-1">Modifiez vos critères de recherche ou de filtrage</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer (Odoo-style) */}
                <div className="px-4 py-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#9B9B9B]">
                  <span>{filteredProducts.length} produit(s)</span>
                  <div className="flex items-center gap-2">
                    <span>1–{filteredProducts.length} sur {filteredProducts.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======== CLIENTS TAB (Odoo-style) ======== */}
        {activeTab === 'clients' && (
          <div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm mb-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 border-b border-[#F0F0F0]">
                 <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedClient(null); setClientModalOpen(true) }}
                  className="flex items-center gap-2 bg-[#714B67] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#5a3a52] transition-all shadow-lg shadow-[#714B67]/20 border border-white/10"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nouveau Laboratoire</span>
                </motion.button>
                <div className="relative flex-1 max-w-sm">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#9B9B9B] text-xs"></i>
                  <input
                    type="text"
                    placeholder="Rechercher un établissement..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-[#D9D9D9] rounded-lg text-sm focus:outline-none focus:border-[#714B67] bg-white"
                  />
                </div>
                <span className="text-xs text-[#9B9B9B] ml-auto">{filteredClients.length} laboratoire(s)</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Établissement</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">ID Structure</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Localisation</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Statut</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {filteredClients.map((client, idx) => (
                      <tr key={client.id} className={`hover:bg-[#FBF9FA] transition-colors ${idx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#f0f7fa] rounded-lg flex items-center justify-center shrink-0">
                              <i className="fas fa-microscope text-[#1F7E9A] text-xs"></i>
                            </div>
                            <div>
                              <div className="font-semibold text-[#2C2C2C]">{client.name}</div>
                              <div className="text-[10px] text-[#9B9B9B]">Laboratoire d'Anatomie Pathologique</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-[11px] font-mono text-[#714B67] bg-[#f5f0f3] px-2 py-0.5 rounded">{client.client_id}</code>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5 text-[#6B6B6B] text-xs">
                            {client.email && <div className="flex items-center gap-1"><i className="fas fa-envelope w-3"></i> <span className="truncate max-w-[140px]">{client.email}</span></div>}
                            {client.phone && <div className="flex items-center gap-1"><i className="fas fa-phone w-3"></i> {client.phone}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6B6B6B] text-xs">
                          <div className="flex items-center gap-1"><i className="fas fa-map-marker-alt text-[#9B9B9B]"></i> {client.city || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f0faf3] text-[#28A745] text-[11px] font-bold rounded-full border border-[#c3e6cb]">
                            <span className="w-1.5 h-1.5 bg-[#28A745] rounded-full"></span>
                            Partenaire
                          </span>
                        </td>
                        <td className="px-4 py-3">
                           <div className="flex gap-2 justify-end">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleViewClient(client.id)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100/50 dark:bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors border border-transparent hover:border-emerald-500/20"
                              title="Voir"
                            >
                              <Eye className="h-4 w-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEditClient(client.id)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100/50 dark:bg-white/5 hover:bg-blue-500/10 hover:text-blue-500 transition-colors border border-transparent hover:border-blue-500/20"
                              title="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDeleteClient(client.id)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100/50 dark:bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 transition-colors border border-transparent hover:border-rose-500/20"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Orders */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 bg-[#f0faf3] rounded-lg flex items-center justify-center">
                <i className="fas fa-shopping-cart text-[#28A745]"></i>
              </div>
              <h2 className="text-lg font-bold text-[#2C2C2C]">Gestion des Commandes</h2>
            </div>
            <OrdersPage merchantId={merchantId} products={products} formatCurrency={formatCurrency} merchantInfo={user} />
          </div>
        )}

        {/* Invoices */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 bg-[#f0f7fa] rounded-lg flex items-center justify-center">
                <i className="fas fa-file-invoice-dollar text-[#1F7E9A]"></i>
              </div>
              <h2 className="text-lg font-bold text-[#2C2C2C]">Facturation & Recouvrement</h2>
            </div>
            <InvoicesListPage merchantId={merchantId} />
          </div>
        )}

        {/* Notifications */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 bg-[#FDEDEC] rounded-lg flex items-center justify-center">
                <i className="fas fa-bell text-[#DC3545]"></i>
              </div>
              <h2 className="text-lg font-bold text-[#2C2C2C]">Centre d'Alertes</h2>
            </div>
            <NotificationsTab merchantId={merchantId} />
          </div>
        )}

        {/* Messages / Discuss */}
        {activeTab === 'emails' && (
          <EmailsTab merchantId={merchantId} />
        )}

        {/* Stock */}
        {activeTab === 'stock' && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 bg-[#fdf8f0] rounded-lg flex items-center justify-center">
                <i className="fas fa-boxes text-[#F39C12]"></i>
              </div>
              <h2 className="text-lg font-bold text-[#2C2C2C]">Gestion d'Inventaire IVD</h2>
            </div>
            <StockManager merchantId={merchantId} />
          </div>
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 bg-[#F5F5F5] rounded-lg flex items-center justify-center">
                <i className="fas fa-cog text-[#6B6B6B]"></i>
              </div>
              <h2 className="text-lg font-bold text-[#2C2C2C]">Paramètres de la Structure</h2>
            </div>
            <MerchantSettingsTab merchantId={merchantId} user={user} />
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modale pour voir un produit */}
      <Modal
        isOpen={viewProductModalOpen}
        onClose={() => setViewProductModalOpen(false)}
        title="Fiche Technique Produit"
        icon="📄"
        size="lg"
      >
        {selectedProduct && (
          <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-4 p-5 bg-[#f5f0f3] rounded-xl border border-[#e9d5e2]">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-[#714B67] text-2xl shadow-sm border border-[#e9d5e2]">
                <i className="fas fa-vial"></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold text-[#2C2C2C] mb-1 truncate">
                  {selectedProduct.name}
                </div>
                <div className="text-xs text-[#6B6B6B] font-medium flex items-center gap-2">
                  <span>REF:</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-[#D9D9D9] text-[#714B67] font-mono">{selectedProduct.reference_code || selectedProduct.id?.slice(-8)}</code>
                </div>
              </div>
            </div>

            {/* Prix & Stock Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#f0faf3] p-4 rounded-xl border border-[#c3e6cb]">
                <div className="text-[10px] font-bold text-[#28A745] uppercase tracking-wider mb-1">
                  Prix Unitaire H.T
                </div>
                <div className="text-2xl font-bold text-[#28A745]">
                  {formatCurrency(selectedProduct.price)}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#D9D9D9]">
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">
                  Stock Disponible
                </div>
                <div className="text-2xl font-bold text-[#2C2C2C]">
                  {(selectedProduct as any).stock_quantity ?? 0} <span className="text-xs font-normal text-[#9B9B9B]">unités</span>
                </div>
              </div>
            </div>

            {/* Détails techniques */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
              {[
                { label: 'Provenance', value: selectedProduct.provenance },
                { label: 'Laboratoire/Fournisseur', value: selectedProduct.supplier },
                { label: 'N° de Lot', value: selectedProduct.lot_number },
                { label: 'Volume', value: selectedProduct.volume_ml ? `${selectedProduct.volume_ml} ml` : null },
              ].filter(f => f.value).map((field, i) => (
                <div key={i}>
                  <div className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-wider mb-0.5">{field.label}</div>
                  <div className="text-sm font-semibold text-[#2C2C2C]">{field.value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {selectedProduct.description && (
              <div className="bg-white p-4 rounded-xl border border-[#D9D9D9]">
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-2">
                  Spécifications / Description
                </div>
                <div className="text-sm text-[#2C2C2C] leading-relaxed">
                  {selectedProduct.description}
                </div>
              </div>
            )}

            {/* Statut et informations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-2">
                  Statut commercial
                </div>
                <div className={`px-4 py-2 bg-white rounded-lg border text-sm font-bold flex items-center justify-center gap-2 ${
                  selectedProduct.active 
                    ? 'text-[#28A745] border-[#c3e6cb]' 
                    : 'text-[#DC3545] border-[#f5c6cb]'
                }`}>
                  {selectedProduct.active ? (
                    <><span className="w-2 h-2 bg-[#28A745] rounded-full"></span> Actif</>
                  ) : (
                    <><span className="w-2 h-2 bg-[#DC3545] rounded-full"></span> Inactif</>
                  )}
                </div>
              </div>
              
              <div>
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-2">
                  ID Interne
                </div>
                <div className="px-4 py-2 bg-white rounded-lg border border-[#D9D9D9] text-xs font-mono text-[#6B6B6B] flex items-center justify-center">
                  {selectedProduct.id}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale pour voir un laboratoire */}
      <Modal
        isOpen={viewClientModalOpen}
        onClose={() => setViewClientModalOpen(false)}
        title="Fiche Établissement Partenaire"
        icon="🏥"
        size="lg"
      >
        {selectedClient && (
          <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-4 p-5 bg-[#f0f7fa] rounded-xl border border-[#d1e9f0]">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-[#1F7E9A] text-2xl shadow-sm border border-[#d1e9f0]">
                <i className="fas fa-microscope"></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold text-[#2C2C2C] mb-1 truncate">
                  {selectedClient.name}
                </div>
                <div className="text-xs text-[#6B6B6B] font-medium flex items-center gap-2">
                  <span>ID Structure:</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-[#D9D9D9] text-[#1F7E9A] font-mono">{selectedClient.client_id}</code>
                </div>
              </div>
            </div>

            {/* Contact & Localisation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#D9D9D9] space-y-3">
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">Coordonnées</div>
                {selectedClient.email && (
                  <div className="flex items-center gap-2 text-sm text-[#2C2C2C]">
                    <i className="fas fa-envelope text-[#9B9B9B] w-4"></i>
                    <span>{selectedClient.email}</span>
                  </div>
                )}
                {selectedClient.phone && (
                  <div className="flex items-center gap-2 text-sm text-[#2C2C2C]">
                    <i className="fas fa-phone text-[#9B9B9B] w-4"></i>
                    <span>{selectedClient.phone}</span>
                  </div>
                )}
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#D9D9D9] space-y-3">
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">Localisation</div>
                <div className="flex items-start gap-2 text-sm text-[#2C2C2C]">
                  <i className="fas fa-map-marker-alt text-[#9B9B9B] w-4 mt-1"></i>
                  <span>{selectedClient.address || 'Adresse non renseignée'}<br/>{selectedClient.city}</span>
                </div>
              </div>
            </div>

            {/* Finance & Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#f0faf3] p-4 rounded-xl border border-[#c3e6cb]">
                <div className="text-[10px] font-bold text-[#28A745] uppercase tracking-wider mb-1">Limite de Crédit</div>
                <div className="text-xl font-bold text-[#28A745]">
                  {selectedClient.credit_limit ? formatCurrency(selectedClient.credit_limit) : 'Aucune limite'}
                </div>
                <div className="text-[10px] text-[#28A745]/70 mt-1">Paiement: {selectedClient.payment_mode || 'Standard'}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#D9D9D9]">
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-2">Préférences Affichage</div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold border ${selectedClient.show_price ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>PRIX {selectedClient.show_price ? 'OUI' : 'NON'}</span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold border ${selectedClient.show_quantity ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>STOCKS {selectedClient.show_quantity ? 'OUI' : 'NON'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => { setViewClientModalOpen(false); handleEditClient(selectedClient.id); }}
                className="px-4 py-2 bg-white border border-[#D9D9D9] text-[#6B6B6B] rounded-lg text-sm font-semibold hover:border-[#1F7E9A] hover:text-[#1F7E9A] transition-colors"
              >
                Éditer le laboratoire
              </button>
              <button
                onClick={() => setViewClientModalOpen(false)}
                className="px-4 py-2 bg-[#714B67] text-white rounded-lg text-sm font-semibold hover:bg-[#5a3a52] transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale pour ajouter/éditer un produit */}
      <ProductForm
        isOpen={productModalOpen}
        onClose={() => {
          setProductModalOpen(false)
          setSelectedProduct(null)
        }}
        onSubmit={handleProductSubmit}
        product={selectedProduct}
      />

      {/* Modale pour ajouter/éditer un client */}
      <ClientForm
        isOpen={clientModalOpen}
        onClose={() => {
          setClientModalOpen(false)
          setSelectedClient(null)
        }}
        onSubmit={handleClientSubmit}
        client={selectedClient}
        merchantId={merchantId}
      />

      {/* Modal Stat BI Glassmorphism Fullscreen */}
      <AnimatePresence>
        {statBIModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            {/* Backdrop Blur Layer */}
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setStatBIModalOpen(false)}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-7xl max-h-[90vh] overflow-y-auto bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] custom-scrollbar"
            >
              {/* Close Button */}
              <button
                onClick={() => setStatBIModalOpen(false)}
                className="sticky top-4 right-4 ml-auto flex items-center justify-center w-10 h-10 rounded-full bg-white/50 hover:bg-white/80 border border-white/50 shadow-sm text-slate-700 transition-all z-10"
              >
                ✕
              </button>

              <div className="p-6 sm:p-10 -mt-10">
                <StatBI merchantId={merchantId} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IN-APP TOAST (Messenger-like) */}
      <AnimatePresence>
        {showOrderToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-20 right-4 z-[200] max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-[#714B67]/20 p-4 flex items-start gap-4 cursor-pointer"
            onClick={() => handleTabClick('orders')}
          >
            <div className="w-12 h-12 bg-[#714B67] text-white rounded-full flex items-center justify-center shrink-0 animate-bounce">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-[#714B67]">Nouvelle Commande !</div>
              <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                Une nouvelle commande <strong>#{latestOrderInfo?.id}</strong> vient d'arriver.
              </div>
              <div className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest">
                Cliquer pour voir
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowOrderToast(false); }}
              className="text-gray-300 hover:text-gray-500"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
