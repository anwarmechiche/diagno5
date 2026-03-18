'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/utils/supabase/client'
import { supabase } from '@/lib/supabase'
import { Product, Order, Client, MerchantSettings } from '@/utils/supabase/types'
import { generateOrderSlip, OrderSlip } from '@/utils/orderUtils'
import ClientShop from './ClientShop'
import ClientOrders from './ClientOrders'
import ClientSettings from './ClientSettings'

// UN SEUL IMPORT POUR TOUTES LES ICÔNES
import { 
  ShoppingCart, 
  Package, 
  Settings as SettingsIcon, 
  Store, 
  LogOut,
  CheckCircle,
  X,
  Bell,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  CreditCard,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Printer,
  Truck,
  Clock,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Loader,
  Edit2,
  Save,
  Lock,
  Unlock,
  Hash,
  Home,
  Flag,
  MapPinned,
  CircleDollarSign,
  MessageSquare,
  BadgeCheck,
  FileDigit,
  Receipt,
  Shield,
  Bookmark,
  Key,
  AtSign,
  Globe,
  Building2,
  CheckSquare,
  XSquare,
  Moon,
  Sun
} from 'lucide-react'

interface ClientDashboardProps {
  client: Client
  merchantId: string
  onLogout: () => void
}

// Interface pour les détails de commande
interface OrderDetails {
  groupId: string
  date: string
  status: string
  orders: Order[]
  totalAmount: number
  merchantInfo?: MerchantSettings
  clientInfo: Client
}

export default function ClientDashboard({ client, merchantId, onLogout }: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState('shop')
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{title: string, message: string} | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('client_theme')
    const initial =
      stored === 'light' || stored === 'dark'
        ? (stored as 'light' | 'dark')
        : window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
          ? 'dark'
          : 'light'
    setTheme(initial)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('client_theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  
  // ============================================
  // PARTIE 1: BOUTIQUE - Produits et Panier
  // ============================================
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [orderSlip, setOrderSlip] = useState<OrderSlip | null>(null)
  const [showOrderSlip, setShowOrderSlip] = useState(false)

  // ============================================
  // PARTIE 2: COMMANDES - Historique et Détails
  // ============================================
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [merchantSettings, setMerchantSettings] = useState<MerchantSettings | null>(null)

  // ============================================
  // PARTIE 3: PARAMÈTRES - Notifications
  // ============================================
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default')
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(true)

  // ============================================
  // FONCTIONS PARTAGÉES
  // ============================================
  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat('fr-DZ', { 
        style: 'currency', 
        currency: merchantSettings?.currency || 'DZD', 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value)
    } catch (e) {
      return `${value} ${merchantSettings?.currency || 'DZD'}`
    }
  }

  const showSystemNotification = useCallback((title: string, message: string) => {
    // Jouer un son + Vibration
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.volume = 0.5
      audio.play()

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100])
      }
    } catch (e) {
      console.warn('Could not play notification sound or vibrate', e)
    }

    if (notificationPermission === 'granted' && 'Notification' in window) {
      try {
        new Notification(title, {
          body: message,
          icon: merchantSettings?.logo_url || '/favicon.ico',
        })
      } catch (e) { console.error('Erreur notification:', e) }
    }
    setNotification({ title, message })
    setTimeout(() => setNotification(null), 5000)
  }, [notificationPermission, merchantSettings])

  // ============================================
  // FONCTIONS BOUTIQUE
  // ============================================
  const addToCart = (productId: string) => {
    setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) newCart[productId] -= 1
      else delete newCart[productId]
      return newCart
    })
  }

  const clearCart = () => {
    setCart({})
    setOrderSlip(null)
    setShowOrderSlip(false)
  }

  const generateSlip = () => {
    const slip = generateOrderSlip(
      client.name || client.email?.split('@')[0] || 'Medecin',
      merchantId,
      Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })),
      products
    )
    setOrderSlip(slip)
    setShowOrderSlip(true)
  }

  const pad4 = (n: number) => String(Math.max(0, Math.trunc(n))).padStart(4, '0')

  const createOrderGroupId = async () => {
    // Numérotation croissante: CMD-0001, CMD-0002, ...
    // Note: sans compteur atomique côté DB, deux checkouts simultanés peuvent théoriquement prendre le même numéro.
    const { data, error } = await supabase
      .from('orders')
      .select('order_group_id, created_at')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(300)

    let max = 0
    if (!error) {
      for (const row of data || []) {
        const m = String((row as any)?.order_group_id || '').match(/CMD-(\d{4})/i)
        if (!m?.[1]) continue
        const n = Number(m[1])
        if (Number.isFinite(n)) max = Math.max(max, n)
      }
    }

    let candidateNum = (max % 9999) + 1

    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = `CMD-${pad4(candidateNum)}`

      const exists = await supabase
        .from('orders')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('order_group_id', candidate)
        .limit(1)

      if (!exists.error && (!exists.data || exists.data.length === 0)) return candidate

      candidateNum = (candidateNum % 9999) + 1
    }

    return `CMD-${pad4(Date.now() % 10000)}`
  }

  const handleCheckout = async () => {
    if (Object.keys(cart).length === 0) {
      showSystemNotification('Panier vide', 'Ajoutez des produits avant de commander')
      return
    }

    setLoading(true)
    try {
      const orderGroupId = await createOrderGroupId()
      const itemsCount = Object.values(cart).reduce((sum, q) => sum + q, 0)

      const promises = Object.entries(cart).map(([productId, quantity]) => {
        return db.createOrder({
          client_id: client.id,
          merchant_id: merchantId,
          product_id: productId,
          quantity: quantity,
          status: 'pending',
          order_group_id: orderGroupId
        })
      })
      
      await Promise.all(promises)

      // Notification offline (email + DB notification best-effort)
      try {
        const totalAmount = Object.entries(cart).reduce((sum, [productId, quantity]) => {
          const product = products.find(p => String(p.id) === String(productId))
          return sum + (Number(product?.price || 0) * Number(quantity || 0))
        }, 0)

        const sendClientConfirmation = window.localStorage.getItem('client_send_confirm_email') !== 'false'

        const apiBase = String(window.localStorage.getItem('app_api_base_url') || '').trim().replace(/\/$/, '')

        await fetch((apiBase ? apiBase + '/api/notify/order' : '/api/notify/order'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            merchantEmail: merchantSettings?.company_email || '',
            merchantName: merchantSettings?.company_name || 'Fournisseur',
            clientId: client.id,
            clientName: client.name || 'Client',
            clientEmail: client.email || '',
            orderGroupId,
            itemsCount,
            totalAmount,
            currency: merchantSettings?.currency || 'DZD',
            sendClientConfirmation,
          }),
        })
      } catch (e) {
        console.warn('Notify order failed', e)
      }

      showSystemNotification('Commande confirmée !', `${itemsCount} article(s) - Réf: ${orderGroupId}`)
      clearCart()
      await loadOrders()
      setActiveTab('orders')
    } catch (error) {
      console.error('Erreur lors de la commande:', error)
      showSystemNotification('Erreur', 'Impossible de passer la commande.')
    } finally {
      setLoading(false)
      setShowOrderSlip(false)
    }
  }

  // ============================================
  // FONCTIONS COMMANDES
  // ============================================
  const loadOrders = useCallback(async () => {
    try {
      const ordersData = await db.getOrders(merchantId)
      const filteredOrders = ordersData
        .filter(order => String(order.client_id) === String(client.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setOrders(filteredOrders)
    } catch (error) {
      console.error('Erreur chargement commandes:', error)
    }
  }, [merchantId, client.id])

  // Regrouper les commandes
  const groupedOrders = orders.reduce((groups, order) => {
    const clientId = order?.client_id ? String(order.client_id) : ''
    const createdAt = order?.created_at || new Date().toISOString()
    
    const date = new Date(createdAt)
    const explicitGroupId = (order as any)?.order_group_id ? String((order as any).order_group_id) : ''
    const groupKey = explicitGroupId || `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${clientId.substring(0, 4)}`
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        id: explicitGroupId || `CMD-${pad4(date.getTime() % 10000)}`,
        date: createdAt,
        status: order.status,
        orders: []
      }
    }
    
    groups[groupKey].orders.push(order)
    if (order.status !== 'delivered') groups[groupKey].status = 'pending'
    
    return groups
  }, {} as Record<string, { id: string, date: string, status: string, orders: Order[] }>)

  const orderGroups = Object.values(groupedOrders).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const openOrderDetails = (group: { id: string, date: string, status: string, orders: Order[] }) => {
    const totalAmount = group.orders.reduce((sum, order) => {
      const product = products.find(p => String(p.id) === String(order.product_id))
      return sum + (product?.price || 0) * order.quantity
    }, 0)

    setSelectedOrder({
      groupId: group.id,
      date: group.date,
      status: group.status,
      orders: group.orders,
      totalAmount,
      merchantInfo: merchantSettings || undefined,
      clientInfo: client
    })
    setShowOrderDetails(true)
  }

  const generateOrderPDF = (orderDetails: OrderDetails) => {
    const win = window.open('', '_blank')
    if (!win) return

    const date = new Date(orderDetails.date)
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

    const shortRef = orderDetails.groupId.length > 12 
      ? orderDetails.groupId.substring(0, 12) + '...' 
      : orderDetails.groupId

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <title>Bon de commande ${shortRef}</title>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f9fafb; padding: 40px 20px; color: #111827; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.05); overflow: hidden; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 32px; }
        .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
        .content { padding: 32px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
        .info-box { background: #f9fafb; padding: 20px; border-radius: 16px; }
        .info-box h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f3f4f6; padding: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #4b5563; text-align: left; }
        td { padding: 16px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        .product-name { font-weight: 600; color: #111827; }
        .total-section { margin-top: 24px; padding-top: 24px; border-top: 2px solid #e5e7eb; display: flex; justify-content: flex-end; }
        .total-box { width: 300px; }
        .grand-total { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 2px solid #e5e7eb; font-size: 18px; font-weight: 700; color: #059669; }
        .footer { margin-top: 32px; padding-top: 32px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; }
        .status { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: ${orderDetails.status === 'delivered' ? '#10b98120' : '#f59e0b20'}; color: ${orderDetails.status === 'delivered' ? '#10b981' : '#f59e0b'}; border: 1px solid ${orderDetails.status === 'delivered' ? '#10b98140' : '#f59e0b40'}; }
        @media print { body { background: white; padding: 0; } .container { box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BON DE COMMANDE</h1>
          <p>Référence: ${orderDetails.groupId}</p>
          <p style="margin-top: 8px;">Date: ${formattedDate}</p>
          <span class="status" style="margin-top: 16px; background: white; color: #059669;">${orderDetails.status === 'delivered' ? 'LIVRÉE' : 'EN COURS'}</span>
        </div>
        <div class="content">
          <div class="info-grid">
            <div class="info-box">
              <h3>FOURNISSEUR</h3>
              <div class="name">${merchantSettings?.company_name || 'TradePro'}</div>
              ${merchantSettings?.company_phone ? `<div class="detail">Tel: ${merchantSettings.company_phone}</div>` : ''}
              ${merchantSettings?.tax_id ? `<div class="detail">NIF: NIF: ${merchantSettings.tax_id}</div>` : ''}
            </div>
            <div class="info-box">
              <h3>MEDECIN</h3>
              <div class="name">${client.name || 'Medecin'}</div>
              ${client.email ? `<div class="detail">Email: ${client.email}</div>` : ''}
              ${client.phone ? `<div class="detail">Tel: ${client.phone}</div>` : ''}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Réf.</th>
                <th>Qté</th>
                <th>Prix unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderDetails.orders.map(order => {
                const product = products.find(p => String(p.id) === String(order.product_id))
                const productIdStr = String(order.product_id)
                const shortProductId = productIdStr.length > 6 ? productIdStr.substring(productIdStr.length - 6) : productIdStr
                return `
                  <tr>
                    <td><div class="product-name">${product?.name || 'Produit'}</div></td>
                    <td><span class="product-ref">${shortProductId}</span></td>
                    <td>${order.quantity}</td>
                    <td>${formatCurrency(product?.price || 0)}</td>
                    <td><strong>${formatCurrency((product?.price || 0) * order.quantity)}</strong></td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <div class="total-box">
              <div class="grand-total">
                <span>TOTAL</span>
                <span>${formatCurrency(orderDetails.totalAmount)}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>${merchantSettings?.company_name || 'TradePro'} - Bon de commande généré le ${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>`

    win.document.write(html)
    win.document.close()
  }

  // ============================================
  // FONCTIONS PARAMÈTRES
  // ============================================
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission as any)
    setShowPermissionPrompt(false)
  }, [])

  // ============================================
  // FONCTION DE MISE À JOUR DU PROFIL CLIENT (AVEC DEBUG)
  // ============================================
const updateClientProfile = async (data: Partial<Client>) => {
  try {
    setLoading(true)
    
    // 1. Récupérer l'ID (on extrait l'ID pour ne pas l'envoyer dans le body de l'UPDATE)
    const { id, ...updateData } = data;
    const targetId = id || client.id;
    
    if (!targetId) {
      throw new Error("ID medecin non trouve");
    }

    console.log(" Envoi vers Supabase pour ID:", targetId, updateData);

    // 2. Mettre à jour dans Supabase
    const { error } = await supabase
      .from('clients')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetId);

    if (error) {
      console.error("Erreur Supabase:", error);
      throw error;
    }
    
    showSystemNotification('Succès', 'Votre profil a été mis à jour.');
    console.log("Profil mis à jour avec succès");

  } catch (error: any) {
    console.error('Erreur lors de la mise à jour:', error);
    showSystemNotification('Erreur', error.message || "Échec de la sauvegarde");
    throw error; // Re-throw pour que ClientSettings puisse gérer l'état 'saving'
  } finally {
    setLoading(false);
  }
}
  // ============================================
  // CHARGEMENT INITIAL
  // ============================================
  useEffect(() => {
    if ('Notification' in window) {
      const perm = Notification.permission as 'default' | 'granted' | 'denied'
      setNotificationPermission(perm)
      if (perm === 'default' || perm === 'denied') setShowPermissionPrompt(true)
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // merchant_settings.merchant_id is UUID in some schemas; avoid 22P02 when merchantId is numeric.
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (uuidRegex.test(String(merchantId))) {
          const { data: settings } = await supabase
            .from('merchant_settings')
            .select('*')
            .eq('merchant_id', merchantId)
            .single()
          if (settings) setMerchantSettings(settings)
        }

        const productsData = await db.getProducts(merchantId)
        setProducts(productsData.filter(p => p.active))

        await loadOrders()
      } catch (error) {
        console.error('Erreur loadData:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [merchantId])

  // Realtime pour les commandes
  useEffect(() => {
    if (!client?.id) return

    const statusLabels: Record<string, string> = {
      pending: "En attente",
      validated: "Acceptée",
      processing: "En cours",
      delivered: "Livrée",
      cancelled: "Annulée"
    }

    const channel = supabase
      .channel(`client:${client.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `client_id=eq.${client.id}`
      }, (payload) => {
        const newStatus = String(payload.new.status || '')
        const oldStatus = String(payload.old.status || '')

        if (newStatus !== oldStatus) {
          const label = statusLabels[newStatus] || newStatus
          showSystemNotification(
            'Mise à jour commande', 
            `Le statut de votre commande est maintenant : ${label}`
          )
          loadOrders()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel).catch(console.error)
    }
  }, [client?.id, loadOrders, showSystemNotification])

  if (loading && products.length === 0) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center dark:bg-black">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-black text-slate-900 dark:text-white transition-colors pb-24 md:pb-8">
      
      {/* Premium Notification Toast (iOS/Messenger style) */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm"
          >
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl text-slate-900 dark:text-white p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center gap-4 border border-white/20 dark:border-white/10">
              <div className="bg-emerald-500 p-2.5 rounded-2xl flex-shrink-0 shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-0.5">{notification.title}</p>
                <p className="text-sm font-bold opacity-90 leading-tight truncate">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Premium (Glassmorphism & Gradients) */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 safe-top">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ rotate: 5 }}
                className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
              >
                <Store className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                  {merchantSettings?.company_name || 'Espace Medecin'}
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{client.name || 'Client Officiel'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all text-slate-600 dark:text-slate-200"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-500 hover:scale-105 active:scale-95 transition-all">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Padding for fixed header */}
      <div className="h-20" />

      {/* Desktop Navigation (Hidden on mobile) */}
      <nav className="hidden md:block bg-white/50 dark:bg-black/50 border-b border-slate-200 dark:border-white/5 mb-8">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-4">
            {[
              { id: 'shop', label: 'Boutique', icon: ShoppingCart },
              { id: 'orders', label: 'Mes Commandes', icon: Package },
              { id: 'settings', label: 'Profil', icon: SettingsIcon },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`group px-6 py-4 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 border-b-2 transition-all relative ${
                  activeTab === id 
                    ? 'border-emerald-500 text-emerald-500' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeTab === id ? 'text-emerald-500' : 'text-slate-400'}`} />
                {label}
                {id === 'orders' && orderGroups.length > 0 && (
                  <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full text-[10px]">
                    {orderGroups.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Contenu Principal with smooth transitions */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'shop' && (
              <ClientShop
                products={products}
                client={client}
                cart={cart}
                onAddToCart={addToCart}
                onRemoveFromCart={removeFromCart}
                onClearCart={clearCart}
                onGenerateSlip={generateSlip}
                onCheckout={handleCheckout}
                formatCurrency={formatCurrency}
                loading={loading}
                showOrderSlip={showOrderSlip}
                orderSlip={orderSlip}
                setShowOrderSlip={setShowOrderSlip}
              />
            )}

            {activeTab === 'orders' && (
              <ClientOrders
                orderGroups={orderGroups}
                products={products}
                client={client}
                merchantSettings={merchantSettings}
                formatCurrency={formatCurrency}
                onOpenOrderDetails={openOrderDetails}
                selectedOrder={selectedOrder}
                showOrderDetails={showOrderDetails}
                onCloseOrderDetails={() => setShowOrderDetails(false)}
                onGeneratePDF={generateOrderPDF}
              />
            )}

            {activeTab === 'settings' && (
              <ClientSettings
                client={client}
                merchantSettings={merchantSettings}
                notificationPermission={notificationPermission}
                showPermissionPrompt={showPermissionPrompt}
                onRequestNotificationPermission={requestNotificationPermission}
                onLogout={onLogout}
                formatCurrency={formatCurrency}
                onUpdateProfile={updateClientProfile}  
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Premium Bottom Navigation (Glassmorphism) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl px-2 py-2 rounded-[2.5rem] border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex justify-between items-center overflow-hidden">
          {[
            { id: 'shop', label: 'Shop', icon: ShoppingCart },
            { id: 'orders', label: 'Commandes', icon: Package },
            { id: 'settings', label: 'Profil', icon: SettingsIcon },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`relative flex flex-col items-center gap-1 flex-1 py-3 px-2 rounded-[2rem] transition-all duration-300 ${
                  isActive ? 'text-emerald-500' : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-[2rem] border border-emerald-500/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 3 : 2} />
                <span className={`text-[10px] font-black uppercase tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {label}
                </span>
                
                {id === 'shop' && Object.keys(cart).length > 0 && (
                  <span className="absolute top-2 right-1/4 w-4 h-4 bg-emerald-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 shadow-sm animate-bounce">
                    {Object.values(cart).reduce((sum, qty) => sum + qty, 0)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
