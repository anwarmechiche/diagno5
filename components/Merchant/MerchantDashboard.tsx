'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart3,
  Boxes,
  Clock,
  FileText,
  Filter,
  LayoutDashboard,
  Package,
  Plus,
  RotateCcw,
  Settings,
  ShoppingCart,
  Users,
  Bell,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ProductForm from '@/components/Merchant/ProductForm'
import ClientForm from '@/components/Merchant/ClientForm'
import OrdersPage from './OrdersPage'
import StockManager from './StockManager'
import InvoicesTab from './InvoicesTab'
import { db } from '@/utils/supabase/client'
import { supabase } from '@/lib/supabase'
import MerchantSettingsTab from '@/components/Merchant/MerchantSettingsTab'
import { Product, Client, Order } from '@/utils/supabase/types'
import StatBI from './statBI'
import PwdIdButton from '@/components/ui/PwdIdButton'
import styles from './MerchantTheme.module.css'

interface MerchantDashboardProps {
  merchantId: string
  user: any
}

// Interface pour les notifications
interface Notification {
  id: string
  orderId: string
  productName: string
  quantity: number
  clientName: string
  timestamp: Date
  read: boolean
}

export default function MerchantDashboard({ merchantId, user }: MerchantDashboardProps) {
  const TAB_EVENT = 'merchant:tab'
  const THEME_EVENT = 'merchant:theme'

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    products: 0,
    clients: 0,
    orders: 0,
    revenue: 0
  })
  const [statBIModalOpen, setStatBIModalOpen] = useState(false)
  
  // États pour les notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const productsRef = useRef<Product[]>([])
  const clientsRef = useRef<Client[]>([])
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set())
  const lastAlertTimestampRef = useRef<string | null>(null)
  
  // États pour les modales
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [viewProductModalOpen, setViewProductModalOpen] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [viewClientModalOpen, setViewClientModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  
  const getOrderDate = (order: Order) => {
    if (order.created_at) return new Date(order.created_at)
    if (order.updated_at) return new Date(order.updated_at)
    return new Date()
  }

  const updateLastAlertTimestamp = useCallback((timestamp?: string) => {
    if (!timestamp) return
    const parsed = new Date(timestamp)
    if (Number.isNaN(parsed.getTime())) return

    const current = lastAlertTimestampRef.current ? new Date(lastAlertTimestampRef.current) : null
    if (current && parsed <= current) return

    const iso = parsed.toISOString()
    lastAlertTimestampRef.current = iso
    if (merchantId && typeof window !== 'undefined') {
      window.localStorage.setItem(`merchant_${merchantId}_last_order_alert`, iso)
    }
  }, [merchantId])

  const recordLatestOrderSeen = useCallback((ordersList: Order[]) => {
    if (ordersList.length === 0) return
    const latestOrder = ordersList.reduce((latest, current) => {
      return getOrderDate(current) > getOrderDate(latest) ? current : latest
    }, ordersList[0])
    updateLastAlertTimestamp(latestOrder.created_at || latestOrder.updated_at || new Date().toISOString())
  }, [updateLastAlertTimestamp])

  const notifyNewOrderArrival = useCallback(
    (
      order: Order,
      context: { productsList?: Product[]; clientsList?: Client[] } = {}
    ) => {
      if (notifiedOrderIdsRef.current.has(order.id)) return
      notifiedOrderIdsRef.current.add(order.id)

      const productsList = context.productsList || productsRef.current
      const clientsList = context.clientsList || clientsRef.current
      const product = productsList.find(p => p.id === order.product_id)
      const client = clientsList.find(c => c.id === order.client_id)

      const notification: Notification = {
        id: `order_${order.id}_${Date.now()}`,
        orderId: order.id,
        productName: product?.name || 'Produit inconnu',
        quantity: order.quantity,
        clientName: client?.name || 'Client inconnu',
        timestamp: new Date(),
        read: false
      }

      setNotifications(prev => [notification, ...prev])
      setAlertMessage(`${client?.name || 'Un client'} vient de commander ${order.quantity}x ${product?.name || 'produit'}.`)
      updateLastAlertTimestamp(order.created_at || order.updated_at || new Date().toISOString())
    },
    [updateLastAlertTimestamp]
  )

  useEffect(() => {
    productsRef.current = products
  }, [products])

  useEffect(() => {
    clientsRef.current = clients
  }, [clients])

  useEffect(() => {
    if (!merchantId) return

    const channel = supabase
      .channel(`merchant-orders-${merchantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `merchant_id=eq.${merchantId}`
        },
        (payload) => {
          const newOrder = payload.new as Order
          setOrders(prev => {
            if (prev.some(order => order.id === newOrder.id)) {
              return prev
            }
            notifyNewOrderArrival(newOrder)
            return [newOrder, ...prev]
          })
        }
      )
    channel.subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [merchantId])

  // Effet pour surveiller les nouvelles commandes
  // Effet pour compter les notifications non lues
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length
    setUnreadCount(unread)
  }, [notifications])

  useEffect(() => {
    if (!alertMessage) return
    const timer = setTimeout(() => setAlertMessage(null), 7000)
    return () => clearTimeout(timer)
  }, [alertMessage])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedTheme = window.localStorage.getItem('merchant_theme')
    const initialTheme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? (storedTheme as 'light' | 'dark')
        : window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
          ? 'dark'
          : 'light'
    setTheme(initialTheme)

    const storedTab = window.localStorage.getItem('merchant_active_tab')
    if (storedTab) setActiveTab(storedTab)

    const onTab = (event: Event) => {
      const custom = event as CustomEvent<{ tabId?: string }>
      if (custom.detail?.tabId) setActiveTab(custom.detail.tabId)
    }
    const onTheme = (event: Event) => {
      const custom = event as CustomEvent<{ theme?: 'dark' | 'light' }>
      if (custom.detail?.theme) setTheme(custom.detail.theme)
    }

    window.addEventListener(TAB_EVENT, onTab)
    window.addEventListener(THEME_EVENT, onTheme)
    return () => {
      window.removeEventListener(TAB_EVENT, onTab)
      window.removeEventListener(THEME_EVENT, onTheme)
    }
  }, [])

  const changeTab = (tabId: string) => {
    setActiveTab(tabId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('merchant_active_tab', tabId)
      window.dispatchEvent(new CustomEvent(TAB_EVENT, { detail: { tabId } }))
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
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

      const lastTimestamp = lastAlertTimestampRef.current
      if (lastTimestamp) {
        const lastDate = new Date(lastTimestamp)
        const newOrders = ordersData
          .filter(order => {
            if (!order.created_at) return false
            return new Date(order.created_at) > lastDate
          })
          .filter(order => !notifiedOrderIdsRef.current.has(order.id))
          .sort((a, b) => getOrderDate(a).getTime() - getOrderDate(b).getTime())

        newOrders.forEach(order => {
          notifyNewOrderArrival(order, {
            productsList: productsData,
            clientsList: clientsData
          })
        })
      }

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
      
      recordLatestOrderSeen(ordersData)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoadError("Impossible de charger vos données. Vérifiez votre connexion et réessayez.")
    } finally {
      setLoading(false)
    }
  }, [merchantId, notifyNewOrderArrival, recordLatestOrderSeen])

  useEffect(() => {
    if (!merchantId) return
    if (typeof window !== 'undefined') {
      lastAlertTimestampRef.current = window.localStorage.getItem(`merchant_${merchantId}_last_order_alert`)
    } else {
      lastAlertTimestampRef.current = null
    }
    notifiedOrderIdsRef.current.clear()
    productsRef.current = []
    clientsRef.current = []
    loadData()
  }, [merchantId, loadData])

  // Fonction pour marquer une notification comme lue
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    )
  }

  // Fonction pour marquer toutes les notifications comme lues
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    )
  }

  // Fonction pour supprimer une notification
  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  // Fonction pour aller à la commande
  const goToOrder = (orderId: string) => {
    changeTab('orders')
    setShowNotifications(false)
    // Vous pouvez ajouter ici un scroll vers la commande spécifique si nécessaire
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
        alert('❌ Produit non trouvé')
      }
    } catch (error) {
      console.error('Error viewing product:', error)
      alert('❌ Erreur lors du chargement du produit')
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
        alert('❌ Produit non trouvé')
      }
    } catch (error) {
      console.error('Error editing product:', error)
      alert('❌ Erreur lors du chargement du produit')
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        const success = await db.deleteProduct(productId)
        if (success) {
          alert('✅ Produit supprimé avec succès')
          await loadData()
        } else {
          alert('❌ Erreur lors de la suppression du produit')
        }
      } catch (error) {
        console.error('Error deleting product:', error)
        alert('❌ Erreur lors de la suppression du produit')
      }
    }
  }

  const handleProductSubmit = async (productData: any) => {
    if (!merchantId) {
      alert("❌ Erreur : Aucun marchand identifié. Veuillez vous reconnecter.")
      return
    }

    console.log("1. Début soumission pour le fournisseur ID:", merchantId)
    
    try {
      const payload = {
        name: productData.name,
        price: parseFloat(productData.price) || 0,
        description: productData.description || "",
        active: productData.active ?? true,
        image: productData.image,
        provenance: productData.provenance,
        expiration_date: productData.expiration_date,
        volume_ml: productData.volume_ml,
        supplier: productData.supplier,
        reference_code: productData.reference_code,
        lot_number: productData.lot_number,
        ref: productData.ref,
        merchant_id: merchantId 
      }

      console.log("2. Payload envoyé à Supabase:", payload)

      const result = await db.createProduct(payload)

      if (result) {
        console.log("3. ✅ Succès stockage dans la BDD:", result)
        alert('✅ Produit enregistré avec succès!')
        setProductModalOpen(false)
        setSelectedProduct(null)
        await loadData()
      } else {
        console.error("3. ❌ Le résultat est vide.")
        alert('❌ Erreur lors de l\'enregistrement')
      }
    } catch (error: any) {
      console.error("3. ❌ ERREUR CRITIQUE:", error)
      alert(`❌ Erreur de stockage: ${error.message}`)
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
        alert('❌ Medecin non trouve')
      }
    } catch (error) {
      console.error('Error viewing client:', error)
      alert('❌ Erreur lors du chargement du medecin')
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
        alert('❌ Medecin non trouve')
      }
    } catch (error) {
      console.error('Error editing client:', error)
      alert('❌ Erreur lors du chargement du medecin')
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('⚠️ Etes-vous sur de vouloir supprimer ce medecin ?')) return

    try {
      const success = await db.deleteClient(clientId)

      if (success) {
        alert('✅ Medecin supprime avec succes')
        await loadData()
        return
      }

      const fallback = confirm(
        "⚠️ Suppression impossible (peut-etre lie a des commandes/factures). Voulez-vous desactiver ce medecin a la place ?"
      )

      if (fallback) {
        const updated = await db.updateClient(clientId, { active: false } as any)
        if (updated) {
          alert('✅ Medecin desactive')
          await loadData()
          return
        }
      }

      alert('❌ Erreur lors de la suppression du medecin')
    } catch (error: any) {
      console.error('Error deleting client:', error)
      alert(`❌ Erreur lors de la suppression du medecin: ${error?.message || ''}`)
    }
  }

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + Math.floor(Math.random() * 10);
  }
  
  const handleClientSubmit = async (clientData: Partial<Client>) => {
    setLoading(true)
    try {
      const password =
        selectedClient
          ? ((clientData as any).password ?? (selectedClient as any)?.password)
          : ((clientData as any).password ?? generateRandomPassword())

      const formattedData = {
        ...clientData,
        merchant_id: Number(merchantId),
        password,
        credit_limit: parseFloat(String(clientData.credit_limit)) || 0,
      }

      if (selectedClient) {
        await db.updateClient(selectedClient.id, formattedData)
        alert('✅ Client mis à jour')
      } else {
        await db.createClient(formattedData) 
        alert('✅ Client créé avec succès')
      }

      setClientModalOpen(false)
      setSelectedClient(null)
      await loadData()

    } catch (error: any) {
      console.error('Error saving client:', error)
      alert(`❌ Erreur: ${error.message || 'Problème de connexion'}`)
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les produits
  const [selectedProvenances, setSelectedProvenances] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedVolumes, setSelectedVolumes] = useState<number[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  const uniqueProvenances = [
    ...new Set(
      products
        .map(p => p.provenance)
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    )
  ].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))

  const uniqueSuppliers = [
    ...new Set(
      products
        .map(p => p.supplier)
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    )
  ].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))

  const uniqueVolumes = [
    ...new Set(
      products
        .map(p => p.volume_ml)
        .filter((value): value is number => typeof value === 'number')
    ),
  ].sort((a, b) => a - b)

  const uniqueNames = [
    ...new Set(
      products
        .map(p => p.name)
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    )
  ].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))

  const hasActiveProductFilters =
    selectedProvenances.length > 0 ||
    selectedSuppliers.length > 0 ||
    selectedVolumes.length > 0 ||
    selectedNames.length > 0

  const activeProductFiltersCount =
    selectedProvenances.length + selectedSuppliers.length + selectedVolumes.length + selectedNames.length

  const resetProductFilters = () => {
    setSelectedProvenances([])
    setSelectedSuppliers([])
    setSelectedVolumes([])
    setSelectedNames([])
  }

  const filteredProducts = products.filter(p => {
    if (selectedProvenances.length > 0) {
      const provenance = typeof p.provenance === 'string' ? p.provenance : ''
      if (!selectedProvenances.includes(provenance)) return false
    }

    if (selectedSuppliers.length > 0) {
      const supplier = typeof p.supplier === 'string' ? p.supplier : ''
      if (!selectedSuppliers.includes(supplier)) return false
    }

    if (selectedVolumes.length > 0) {
      if (typeof p.volume_ml !== 'number' || !selectedVolumes.includes(p.volume_ml)) return false
    }

    if (selectedNames.length > 0) {
      if (!selectedNames.includes(p.name)) return false
    }

    return true
  });

  const tabs: Array<{ id: string; label: string; Icon: any }> = [
    { id: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
    { id: 'products', label: 'Produits', Icon: Package },
    { id: 'clients', label: 'Médecins', Icon: Users },
    { id: 'orders', label: 'Commandes', Icon: ShoppingCart },
    { id: 'invoices', label: 'Factures', Icon: FileText },
    { id: 'stock', label: 'Stock', Icon: Boxes },
    { id: 'settings', label: 'Paramètres', Icon: Settings },
  ]

  const isInitialLoading =
    loading && !loadError && products.length === 0 && clients.length === 0 && orders.length === 0

  const isInitialError =
    Boolean(loadError) && products.length === 0 && clients.length === 0 && orders.length === 0

  if (isInitialLoading) {
    return (
      <div className={`${styles.theme} min-h-screen`} data-theme={theme}>
        <div className={`${styles.surface} space-y-6 p-4 sm:p-6 animate-fade-in`}>
          <Card className="p-8 border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 rounded bg-white/10" />
              <div className="h-4 w-96 rounded bg-white/10" />
              <div className="h-10 w-40 rounded bg-white/10" />
            </div>
          </Card>
          <Card className="p-6 border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 rounded bg-white/10" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="h-16 rounded-xl bg-white/10" />
                <div className="h-16 rounded-xl bg-white/10" />
                <div className="h-16 rounded-xl bg-white/10" />
                <div className="h-16 rounded-xl bg-white/10" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (isInitialError) {
    return (
      <div className={`${styles.theme} min-h-screen`} data-theme={theme}>
        <div className={`${styles.surface} space-y-6 p-4 sm:p-6 animate-fade-in`}>
          <Card className="p-8 border border-red-200/50 bg-red-500/10 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-red-600">Erreur de chargement</p>
                <p className="mt-1 text-sm text-red-600/80">{loadError}</p>
              </div>
              <Button onClick={loadData} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold">
                Réessayer
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.theme} min-h-screen`} data-theme={theme}>
      <div className={`${styles.surface} space-y-6 p-4 sm:p-6 animate-fade-in`}>
        {/* Header avec notifications */}
        <Card className="p-8 bg-[color:var(--cardStrong)] border border-[color:var(--border)] backdrop-blur-md shadow-2xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-6">
            <div className="relative group">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 via-blue-700 to-blue-900 rounded-2xl flex items-center justify-center text-white text-5xl shadow-2xl shadow-blue-600/30 transform group-hover:scale-105 transition-transform duration-300">
                🏢
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="px-4 py-1.5 bg-[color:var(--accentBg)] border border-[color:var(--accentBorder)] text-[color:var(--text)] rounded-full text-xs font-bold uppercase tracking-wider animate-fade-in">
                  Administrateur des ventes
                </div>
                <div className="px-4 py-1.5 bg-[rgba(62,207,142,0.1)] border border-[rgba(62,207,142,0.25)] text-[color:var(--text)] rounded-full text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[color:var(--emerald)] rounded-full animate-pulse"></span>
                  Compte Actif
                </div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-black mb-3 tracking-tight bg-gradient-to-r from-[color:var(--text)] to-[color:var(--textMuted)] bg-clip-text text-transparent">
                {user?.name || 'Société'}
              </h1>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)]">
                  <span className="text-[color:var(--textMuted)]">ID:</span>
                  <code className="text-[color:var(--accentSolid)] font-mono">{user?.merchant_id}</code>
                </div>
                
                <button
                  type="button"
                  onClick={() => setStatBIModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[color:var(--accentBorder)] bg-[color:var(--accentBg)] text-[color:var(--text)] hover:bg-[rgba(0,180,216,0.18)] transition-all"
                >
                  <BarChart3 className="h-4 w-4 text-[color:var(--accentSolid)]" />
                  Statistiques BI
                </button>
              </div>
            </div>
            
            {/* Section des notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-3 rounded-xl bg-[color:var(--card)] border border-[color:var(--border)] hover:bg-[color:var(--accentBg)] transition-all"
              >
                <Bell className="h-5 w-5 text-[color:var(--text)]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {/* Dropdown des notifications */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 max-h-[500px] overflow-y-auto rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] shadow-2xl z-50">
                  <div className="sticky top-0 bg-[color:var(--card)] p-4 border-b border-[color:var(--border)] flex items-center justify-between">
                    <h3 className="font-bold text-[color:var(--text)]">Notifications</h3>
                    {notifications.length > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Tout marquer comme lu
                      </button>
                    )}
                  </div>
                  
                  <div className="divide-y divide-[color:var(--border)]">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-12 w-12 mx-auto mb-3 text-[color:var(--textMuted)] opacity-50" />
                        <p className="text-sm text-[color:var(--textMuted)]">Aucune notification</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-[color:var(--accentBg)] transition-colors cursor-pointer ${
                            !notification.read ? 'bg-blue-50/10' : ''
                          }`}
                          onClick={() => {
                            markAsRead(notification.id)
                            goToOrder(notification.orderId)
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {!notification.read ? (
                                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                              ) : (
                                <CheckCircle2 className="h-4 w-4 mt-1 text-green-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[color:var(--text)]">
                                Nouvelle commande reçue !
                              </p>
                              <p className="text-xs text-[color:var(--textMuted)] mt-1">
                                {notification.clientName} a commandé{' '}
                                <span className="font-semibold text-[color:var(--text)]">
                                  {notification.quantity}x {notification.productName}
                                </span>
                              </p>
                              <p className="text-xs text-[color:var(--textMuted)] mt-2">
                                {new Date(notification.timestamp).toLocaleString('fr-FR')}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeNotification(notification.id)
                              }}
                              className="flex-shrink-0 p-1 hover:bg-[color:var(--border)] rounded-lg transition-colors"
                            >
                              <X className="h-3 w-3 text-[color:var(--textMuted)]" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {alertMessage && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.08)] px-4 py-3 shadow-inner text-sm font-semibold text-[color:var(--textMuted)]">
              <AlertCircle className="h-4 w-4 text-[color:var(--accentSolid)]" />
              <span>{alertMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between pt-6 border-t border-[color:var(--border)]">
            <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--textMuted)]">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)]">
                <span>👤</span> 
                <span className="font-semibold">{user?.name}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)]">
                <span>📧</span> 
                <span className="font-medium">{user?.email || 'contact@merchant.dz'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-4 lg:mt-0">
              <div className="px-4 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-xs font-bold text-[color:var(--textMuted)]">
                🕐 Dernière connexion: {new Date().toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs Navigation - Modern Design */}
        <Card className="p-6 border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md shadow-2xl">
          <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--cardStrong)] p-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.Icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => changeTab(tab.id)}
                  className={`flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,216,0.35)] ${
                    isActive
                      ? 'bg-gradient-to-r from-[#00b4d8] to-[#2e86de] text-white shadow-lg'
                      : 'text-[color:var(--textMuted)] hover:bg-[color:var(--cardStrong)] hover:text-[color:var(--text)]'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-[color:var(--textMuted)]'}`} />
                  <span>{tab.label}</span>
                  {tab.id === 'orders' && unreadCount > 0 && (
                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Le reste du contenu reste identique */}
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md p-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">Produits</p>
                      <p className="mt-2 text-3xl font-black text-[color:var(--text)]">{stats.products}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md p-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">Médecins</p>
                      <p className="mt-2 text-3xl font-black text-[color:var(--text)]">{stats.clients}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
                      <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md p-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">Commandes</p>
                      <p className="mt-2 text-3xl font-black text-[color:var(--text)]">{stats.orders}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
                      <ShoppingCart className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md p-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">Revenu</p>
                      <p className="mt-2 text-2xl font-black text-[color:var(--text)]">{formatCurrency(stats.revenue)}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
                      <BarChart3 className="h-5 w-5 text-indigo-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md p-5 shadow-xl lg:col-span-1">
                  <p className="text-sm font-bold text-[color:var(--text)]">Actions rapides</p>
                  <div className="mt-4 space-y-3">
                    <Button
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setSelectedProduct(null)
                        setProductModalOpen(true)
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold"
                    >
                      Ajouter un produit
                    </Button>

                    <Button
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setSelectedClient(null)
                        setClientModalOpen(true)
                      }}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold"
                    >
                      Ajouter un médecin
                    </Button>

                    <Button
                      variant="outline"
                      icon={<ShoppingCart className="h-4 w-4" />}
                      onClick={() => changeTab('orders')}
                      className="w-full"
                    >
                      Voir les commandes
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md p-5 shadow-xl lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[color:var(--text)]">Dernières commandes</p>
                    <button
                      type="button"
                      onClick={() => changeTab('orders')}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      Tout voir
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {orders.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        Aucune commande pour le moment.
                      </div>
                    ) : (
                      orders.slice(0, 5).map((order: any) => {
                        const product = products.find(p => String(p.id) === String(order.product_id))
                        const createdAt = order?.created_at ? new Date(order.created_at) : null
                        return (
                          <div key={String(order.id)} className="flex items-center justify-between p-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[color:var(--text)]">
                                {product?.name || 'Produit'} · x{order?.quantity ?? 1}
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-xs text-[color:var(--textMuted)]">
                                <Clock className="h-3.5 w-3.5" />
                                {createdAt ? createdAt.toLocaleString('fr-FR') : '—'}
                              </p>
                            </div>
                            <div className="ml-4 shrink-0 text-sm font-bold text-[color:var(--text)]">
                              {formatCurrency(Number(order?.quantity || 1) * Number(product?.price || 0))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Products Tab - (contenu inchangé) */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <Button 
                  icon={<span>➕</span>}
                  onClick={() => {
                    setSelectedProduct(null)
                    setProductModalOpen(true)
                  }}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold shadow-lg shadow-blue-600/30 hover:shadow-xl hover:scale-105 transition-all"
                >
                  Ajouter un produit
                </Button>
                
                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Rechercher un produit..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-80 pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-md p-5 shadow-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <Filter className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[color:var(--text)]">Filtres</p>
                      <p className="text-xs text-[color:var(--textMuted)]">Affinez la liste des produits</p>
                    </div>
                  </div>

                  {hasActiveProductFilters && (
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                      {activeProductFiltersCount} filtre(s) actif(s)
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">
                      Provenance
                    </label>
                    <select
                      value={selectedProvenances[0] || ''}
                      onChange={(e) => setSelectedProvenances(e.target.value ? [e.target.value] : [])}
                      className={`mt-2 w-full rounded-xl border bg-[color:var(--cardStrong)] px-3 py-2 text-sm text-[color:var(--text)] shadow-sm outline-none transition focus:border-[color:var(--accentBorder)] focus:ring-2 focus:ring-[color:var(--accentBg)] ${
                        selectedProvenances.length > 0 ? 'border-[color:var(--accentBorder)]' : 'border-[color:var(--border)]'
                      }`}
                    >
                      <option value="">Toutes les provenances</option>
                      {uniqueProvenances.map((provenance) => (
                        <option key={provenance} value={provenance}>
                          {provenance}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">
                      Fournisseur
                    </label>
                    <select
                      value={selectedSuppliers[0] || ''}
                      onChange={(e) => setSelectedSuppliers(e.target.value ? [e.target.value] : [])}
                      className={`mt-2 w-full rounded-xl border bg-[color:var(--cardStrong)] px-3 py-2 text-sm text-[color:var(--text)] shadow-sm outline-none transition focus:border-[color:var(--accentBorder)] focus:ring-2 focus:ring-[color:var(--accentBg)] ${
                        selectedSuppliers.length > 0 ? 'border-[color:var(--accentBorder)]' : 'border-[color:var(--border)]'
                      }`}
                    >
                      <option value="">Tous les fournisseurs</option>
                      {uniqueSuppliers.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">
                      Volume (ml)
                    </label>
                    <select
                      value={selectedVolumes[0]?.toString() || ''}
                      onChange={(e) => {
                        const { value } = e.target
                        setSelectedVolumes(value ? [Number(value)] : [])
                      }}
                      className={`mt-2 w-full rounded-xl border bg-[color:var(--cardStrong)] px-3 py-2 text-sm text-[color:var(--text)] shadow-sm outline-none transition focus:border-[color:var(--accentBorder)] focus:ring-2 focus:ring-[color:var(--accentBg)] ${
                        selectedVolumes.length > 0 ? 'border-[color:var(--accentBorder)]' : 'border-[color:var(--border)]'
                      }`}
                    >
                      <option value="">Tous les volumes</option>
                      {uniqueVolumes.map((volume) => (
                        <option key={volume} value={volume.toString()}>
                          {volume} ml
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--textMuted)]">
                      Nom du produit
                    </label>
                    <select
                      value={selectedNames[0] || ''}
                      onChange={(e) => setSelectedNames(e.target.value ? [e.target.value] : [])}
                      className={`mt-2 w-full rounded-xl border bg-[color:var(--cardStrong)] px-3 py-2 text-sm text-[color:var(--text)] shadow-sm outline-none transition focus:border-[color:var(--accentBorder)] focus:ring-2 focus:ring-[color:var(--accentBg)] ${
                        selectedNames.length > 0 ? 'border-[color:var(--accentBorder)]' : 'border-[color:var(--border)]'
                      }`}
                    >
                      <option value="">Tous les noms</option>
                      {uniqueNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-[color:var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[color:var(--textMuted)]">{filteredProducts.length} produit(s) trouvé(s)</p>
                  <Button
                    variant="outline"
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={resetProductFilters}
                    disabled={!hasActiveProductFilters}
                    className={`${
                      hasActiveProductFilters
                        ? 'border-[rgba(201,168,76,0.35)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.08)]'
                        : 'opacity-50'
                    }`}
                  >
                    Réinitialiser les filtres
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl">
                <table className="w-full">
                  <thead className="bg-[color:var(--cardStrong)]">
                    <tr>
                      <th className="text-left p-5 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        Produit
                      </th>
                      <th className="text-left p-5 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        Provenance
                      </th>
                      <th className="text-left p-5 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        Volume
                      </th>
                      <th className="text-left p-5 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        Référence
                      </th>
                      <th className="text-left p-4 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        lot
                      </th>
                      <th className="text-left p-5 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        Prix
                      </th>
                      <th className="text-left p-7 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="text-center p-7 text-xs font-black text-[color:var(--textMuted)] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center">
                          <div className="text-6xl mb-4">⚗️</div>
                          <p className="text-lg font-bold text-slate-600 mb-2">Aucun produit trouvé</p>
                          <p className="text-sm text-slate-500">Ajoutez votre premier produit pour commencer</p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product, index) => (
                        <tr 
                          key={product.id} 
                          className="border-t border-[color:var(--border)] hover:bg-[color:var(--accentBg)] transition-colors"
                          style={{animationDelay: `${index * 50}ms`}}
                        >
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl">
                                ⚗️
                              </div>
                              <div>
                                <div className="font-bold text-[color:var(--text)]">{product.name}</div>
                                <div className="text-xs text-[color:var(--textMuted)] font-mono">ID: {String(product.id).slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl">
                                ⚗️
                              </div>
                              <div>
                                <div className="font-bold text-[color:var(--text)]">{product.provenance}</div>
                                <div className="text-xs text-[color:var(--textMuted)] font-mono">ID: {String(product.id).slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl">
                                ⚗️
                              </div>
                              <div>
                                <div className="font-bold text-[color:var(--text)]">
                                  {product.volume_ml} <span className="text-sm font-normal text-[color:var(--textMuted)]">ml</span>
                                </div>
                                <div className="text-xs text-[color:var(--textMuted)] font-mono">ID: {String(product.id).slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl">
                                ⚗️
                              </div>
                              <div>
                                <div className="font-bold text-[color:var(--text)]">{product.reference_code}</div>
                                <div className="text-xs text-[color:var(--textMuted)] font-mono">ID: {String(product.id).slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl">
                                ⚗️
                              </div>
                              <div>
                                <div className="font-bold text-[color:var(--text)]">{product.lot_number}</div>
                                <div className="text-xs text-[color:var(--textMuted)] font-mono">ID: {String(product.id).slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="font-black text-lg text-[color:var(--text)]">{formatCurrency(product.price)}</div>
                          </td>
                          <td className="p-5">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                              product.active 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${product.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              {product.active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="p-5">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleViewProduct(product.id)}
                                className="group relative p-2.5 rounded-xl backdrop-blur-md bg-white/30 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(173, 216, 255, 0.4), rgba(135, 206, 250, 0.3))',
                                  WebkitBackdropFilter: 'blur(10px)',
                                  backdropFilter: 'blur(10px)',
                                  boxShadow: '0 8px 32px rgba(135, 206, 250, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
                                }}
                              >
                                <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                <span className="relative text-blue-600/90 text-lg">👁️</span>
                              </button>

                              <button
                                onClick={() => handleEditProduct(product.id)}
                                className="group relative p-2.5 rounded-xl backdrop-blur-md bg-white/30 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(173, 216, 255, 0.4), rgba(135, 206, 250, 0.3))',
                                  WebkitBackdropFilter: 'blur(10px)',
                                  backdropFilter: 'blur(10px)',
                                  boxShadow: '0 8px 32px rgba(135, 206, 250, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
                                }}
                              >
                                <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                <span className="relative text-blue-600/90 text-lg">✏️</span>
                              </button>

                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="group relative p-2.5 rounded-xl backdrop-blur-md bg-white/30 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(173, 216, 255, 0.4), rgba(135, 206, 250, 0.3))',
                                  WebkitBackdropFilter: 'blur(10px)',
                                  backdropFilter: 'blur(10px)',
                                  boxShadow: '0 8px 32px rgba(135, 206, 250, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
                                }}
                              >
                                <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                <span className="relative text-blue-600/90 text-lg">🗑️</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Clients Tab */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <Button 
                  icon={<span>➕</span>}
                  onClick={() => {
                    setSelectedClient(null)
                    setClientModalOpen(true)
                  }}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold shadow-lg shadow-green-600/30 hover:shadow-xl hover:scale-105 transition-all"
                >
                  Ajouter un medecin
                </Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 shadow-lg">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                    <tr>
                      <th className="text-left p-5 text-xs font-black text-slate-700 uppercase tracking-wider">Nom</th>
                      <th className="text-left p-5 text-xs font-black text-slate-700 uppercase tracking-wider">ID</th>
                      <th className="text-left p-5 text-xs font-black text-slate-700 uppercase tracking-wider">Téléphone</th>
                      <th className="text-left p-5 text-xs font-black text-slate-700 uppercase tracking-wider">Ville</th>
                      <th className="text-right p-5 text-xs font-black text-slate-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center">
                          <div className="text-6xl mb-4">👥</div>
                          <p className="text-lg font-bold text-slate-600 mb-2">Aucun medecin enregistré</p>
                          <p className="text-sm text-slate-500">Ajoutez votre premier medecin pour commencer</p>
                        </td>
                      </tr>
                    ) : (
                      clients.map((client, index) => (
                        <tr 
                          key={client.id} 
                          className="border-t-2 border-slate-100 hover:bg-green-50/50 transition-colors"
                          style={{animationDelay: `${index * 50}ms`}}
                        >
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center text-2xl">
                                👤
                              </div>
                              <div className="font-bold text-[color:var(--text)]">{client.name}</div>
                            </div>
                          </td>
                          <td className="p-5">
                            <code className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-800 font-bold">
                              {client.client_id}
                            </code>
                          </td>
                          <td className="p-5 text-slate-700 font-medium">{client.phone || '-'}</td>
                          <td className="p-5 text-slate-700 font-medium">{client.city || '-'}</td>
                          <td className="p-5">
                            <div className="flex gap-2 justify-end">
                              <Button 
                                size="sm" 
                                variant="success" 
                                icon={<span>👁️</span>}
                                onClick={() => handleViewClient(client.id)}
                                className="hover:scale-110 transition-transform"
                              />
                              <PwdIdButton client={client} size="sm" />
                              <Button 
                                size="sm" 
                                variant="primary" 
                                icon={<span>✏️</span>}
                                onClick={() => handleEditClient(client.id)}
                                className="hover:scale-110 transition-transform"
                              />
                              <Button 
                                size="sm" 
                                variant="danger" 
                                icon={<span>🗑️</span>}
                                onClick={() => handleDeleteClient(client.id)}
                                className="hover:scale-110 transition-transform"
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <OrdersPage 
              merchantId={merchantId} 
              products={products} 
              formatCurrency={formatCurrency} 
            />
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <InvoicesTab
              merchantId={merchantId}
              products={products}
              clients={clients}
              orders={orders}
              formatCurrency={formatCurrency}
            />
          )}

          {/* Stock Tab */}
          {activeTab === 'stock' && (
            <StockManager merchantId={merchantId} />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <MerchantSettingsTab 
              merchantId={merchantId} 
              user={user} 
            />
          )}
        </Card>

        {/* Modales - Product View */}
        <Modal
          isOpen={viewProductModalOpen}
          onClose={() => setViewProductModalOpen(false)}
          title="Détails du produit"
          icon="⚗️"
          size="lg"
        >
          {selectedProduct && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-white rounded-2xl border-2 border-blue-100">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center text-white text-4xl shadow-xl">
                  ⚗️
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-black text-slate-900 mb-2">{selectedProduct.name}</h2>
                  <code className="text-xs bg-slate-100 px-3 py-1 rounded-lg font-mono text-slate-600">
                    ID: {selectedProduct.id}
                  </code>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border-2 border-blue-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prix</div>
                  <div className="text-3xl font-black text-blue-600">{formatCurrency(selectedProduct.price)}</div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl border-2 border-green-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Statut</div>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold ${
                    selectedProduct.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedProduct.active ? '✅ Actif' : '❌ Inactif'}
                  </div>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Description</div>
                  <p className="text-slate-700 leading-relaxed">{selectedProduct.description}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t-2 border-slate-100">
                <Button
                  variant="primary"
                  icon={<span>✏️</span>}
                  onClick={() => {
                    setViewProductModalOpen(false)
                    handleEditProduct(selectedProduct.id)
                  }}
                >
                  Éditer ce produit
                </Button>
                <Button variant="outline" onClick={() => setViewProductModalOpen(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal - Client View */}
        <Modal
          isOpen={viewClientModalOpen}
          onClose={() => setViewClientModalOpen(false)}
          title="Détails du client"
          icon="👥"
          size="lg"
        >
          {selectedClient && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-50 to-white rounded-2xl border-2 border-green-100">
                <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center text-white text-4xl shadow-xl">
                  👤
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-black text-slate-900 mb-2">{selectedClient.name}</h2>
                  <code className="text-xs bg-slate-100 px-3 py-1 rounded-lg font-mono text-slate-600">
                    ID: {selectedClient.client_id}
                  </code>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Contact</div>
                  <div className="space-y-2">
                    {selectedClient.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>📧</span> {selectedClient.email}
                      </div>
                    )}
                    {selectedClient.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>📱</span> {selectedClient.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Localisation</div>
                  <div className="space-y-2">
                    {selectedClient.city && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>📍</span> {selectedClient.city}
                      </div>
                    )}
                    {selectedClient.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>🏠</span> {selectedClient.address}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t-2 border-slate-100">
                <Button
                  variant="primary"
                  icon={<span>✏️</span>}
                  onClick={() => {
                    setViewClientModalOpen(false)
                    handleEditClient(selectedClient.id)
                  }}
                >
                  Éditer ce client
                </Button>
                <Button variant="outline" onClick={() => setViewClientModalOpen(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal - Product Form */}
        <ProductForm
          isOpen={productModalOpen}
          onClose={() => {
            setProductModalOpen(false)
            setSelectedProduct(null)
          }}
          onSubmit={handleProductSubmit}
          product={selectedProduct}
        />

        {/* Modal - Client Form */}
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
        
        {/* Modal Statistiques BI */}
        {statBIModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/20 animate-fade-in"
            onClick={() => setStatBIModalOpen(false)}
          >
            <div 
              className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-white/20 bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 backdrop-blur-md flex items-center justify-center text-purple-300 text-xl border border-purple-500/30">
                    📊
                  </div>
                  <h2 className="text-xl font-bold text-white drop-shadow-lg">
                    Tableau de Bord Statistique
                  </h2>
                </div>
                <button
                  onClick={() => setStatBIModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all"
                >
                  ✕
                </button>
              </div>
              
              <div className="overflow-y-auto p-6 max-h-[calc(90vh-80px)] bg-white/5 backdrop-blur-sm">
                <StatBI merchantId={merchantId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
