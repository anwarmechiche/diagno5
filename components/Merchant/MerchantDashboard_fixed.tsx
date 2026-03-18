'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ProductForm from '@/components/Merchant/ProductForm'
import ClientForm from '@/components/Merchant/ClientForm'
import OrdersPage from '@/components/Merchant/OrdersPage'
import InvoicesListPage from '@/components/Merchant/InvoicesListPage'
import NotificationsTab from '@/components/Merchant/NotificationsTab'
import StockManager from '@/components/Merchant/StockManager'
import { db } from '@/utils/supabase/client'
import MerchantSettingsTab from '@/components/Merchant/MerchantSettingsTab'
import { Product, Client, Order } from '@/utils/supabase/types'
import {
  BellRing,
  Boxes,
  FileText,
  LayoutDashboard,
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

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

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600">Chargement des données...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-8 bg-gradient-to-br from-slate-50 to-white border border-slate-200/50 shadow-xl">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-teal-600 to-blue-600 rounded-2xl flex items-center justify-center text-white text-5xl shadow-2xl border border-white/20 backdrop-blur-sm">
            🏥
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-600 rounded-full animate-pulse"></span>
              Système Médical de Gestion
            </div>
            <div className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent font-serif mb-3">
              {user?.name || 'Établissement Médical'}
            </div>
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-teal-100 to-blue-100 backdrop-blur-sm rounded-full text-sm font-semibold border border-teal-200">
              <span className="w-2 h-2 bg-teal-600 rounded-full"></span>
              <span className="text-blue-700">ID Établissement:</span>
              <span className="font-mono text-blue-700">{user?.merchant_id}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <span>👨‍⚕️</span>
              <span className="font-medium">{user?.name}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="font-medium">Actif</span>
            </div>
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(user?.merchant_id)
              alert('ID établissement copié dans le presse-papier')
            }}
            className="bg-gradient-to-r from-teal-600 to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
            icon={<span>📋</span>}
          >
            Copier ID
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200/50 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-teal-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl border border-white/20">
              💊
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
              ↑ 12%
            </div>
          </div>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Médicaments
          </div>
          <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent font-serif">
            {stats.products}
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            En stock disponible
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200/50 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl border border-white/20">
              👨‍⚕️
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
              ↑ 8%
            </div>
          </div>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Médecins
          </div>
          <div className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent font-serif">
            {stats.clients}
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            Professionnels actifs
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200/50 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl border border-white/20">
              📋
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
              ↑ 24%
            </div>
          </div>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Ordonnances
          </div>
          <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent font-serif">
            {stats.orders}
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            Prescriptions ce mois
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200/50 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl border border-white/20">
              💎
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
              ↑ 18%
            </div>
          </div>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Chiffre d'Affaires
          </div>
          <div className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent font-serif">
            {formatCurrency(stats.revenue)}
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            Recettes totales
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="p-6 bg-gradient-to-br from-white to-slate-50 border border-slate-200/50 shadow-xl">
        <div className="flex flex-wrap gap-3 mb-8 bg-gradient-to-r from-slate-50 to-white p-2 rounded-xl border border-slate-200/30">
          {[
            { id: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard, color: 'from-blue-600 to-teal-600' },
            { id: 'products', label: 'Médicaments', Icon: Package, color: 'from-emerald-500 to-emerald-600' },
            { id: 'clients', label: 'Médecins', Icon: Users, color: 'from-amber-500 to-orange-500' },
            { id: 'orders', label: 'Ordonnances', Icon: ShoppingCart, color: 'from-yellow-500 to-yellow-600' },
            { id: 'invoices', label: 'Facturation', Icon: FileText, color: 'from-teal-600 to-blue-600' },
            { id: 'notifications', label: 'Alertes', Icon: BellRing, color: 'from-rose-500 to-pink-500' },
            { id: 'stock', label: 'Inventaire', Icon: Boxes, color: 'from-indigo-500 to-purple-500' },
            { id: 'settings', label: 'Paramètres', Icon: Settings, color: 'from-slate-600 to-slate-700' },
          ].map(({ id, label, Icon, color }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id)
                if (typeof window !== 'undefined') window.localStorage.setItem('merchant_active_tab', id)
                if (typeof onTabChange === 'function') onTabChange(id)
              }}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-3 ${
                activeTab === id
                  ? `bg-gradient-to-r ${color} text-white shadow-lg transform scale-105 border-0`
                  : 'text-slate-600 hover:text-blue-600 hover:bg-white hover:shadow-md border border-slate-200/50'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="text-center py-10 text-gray-500">
            Choisissez un onglet dans le menu pour continuer.
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="flex flex-wrap gap-4 items-center mb-6">
              <Button 
                icon={<span>💊</span>}
                onClick={() => {
                  setSelectedProduct(null)
                  setProductModalOpen(true)
                }}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Ajouter un médicament
              </Button>
              <div className="flex-1 flex gap-3 ml-auto">
                <input
                  type="text"
                  placeholder="Rechercher un médicament..."
                  className="form-input flex-1 max-w-xs border border-slate-200 rounded-lg focus:border-teal-600 focus:ring-teal-600"
                />
                <Button 
                  variant="success" 
                  size="sm" 
                  icon={<span>🔍</span>}
                  className="bg-gradient-to-r from-teal-600 to-blue-600 text-white border-0"
                >
                  Rechercher
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/50 shadow-xl bg-gradient-to-br from-white to-slate-50">
              <table className="w-full font-sans">
                <thead className="bg-gradient-to-r from-blue-600 to-teal-600 text-white">
                  <tr>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Médicament
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Prix
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr key={product.id} className={`border-t border-slate-100 hover:bg-gradient-to-r hover:from-teal-50 hover:to-blue-50 transition-all duration-300 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center text-emerald-700 font-bold">
                            💊
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{product.name}</div>
                            <div className="text-xs text-slate-500">ID: {product.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="font-bold text-lg bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                          {formatCurrency(product.price)}
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="font-semibold text-emerald-700">Disponible</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="success" 
                            icon={<span>👁️</span>}
                            onClick={() => handleViewProduct(product.id)}
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          >
                            Voir
                          </Button>
                          <Button 
                            size="sm" 
                            variant="primary" 
                            icon={<span>✏️</span>}
                            onClick={() => handleEditProduct(product.id)}
                            className="bg-teal-600 text-white border-0 hover:bg-blue-600"
                          >
                            Éditer
                          </Button>
                          <Button 
                            size="sm" 
                            variant="danger" 
                            icon={<span>🗑️</span>}
                            onClick={() => handleDeleteProduct(product.id)}
                            className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          >
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div>
            <div className="flex flex-wrap gap-4 items-center mb-6">
              <Button 
                icon={<span>👨‍⚕️</span>}
                onClick={() => {
                  setSelectedClient(null)
                  setClientModalOpen(true)
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Ajouter un médecin
              </Button>
              <div className="flex-1 flex gap-3 ml-auto">
                <input
                  type="text"
                  placeholder="Rechercher un médecin..."
                  className="form-input flex-1 max-w-xs border border-slate-200 rounded-lg focus:border-amber-500 focus:ring-amber-500"
                />
                <Button 
                  variant="success" 
                  size="sm" 
                  icon={<span>🔍</span>}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
                >
                  Rechercher
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/50 shadow-xl bg-gradient-to-br from-white to-slate-50">
              <table className="w-full font-sans">
                <thead className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <tr>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Médecin
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      ID Professionnel
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Localisation
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="text-left p-5 text-sm font-bold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, index) => (
                    <tr key={client.id} className={`border-t border-slate-100 hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-orange-50/50 transition-all duration-300 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center text-amber-700 font-bold">
                            👨‍⚕️
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{client.name}</div>
                            <div className="text-xs text-slate-500">Professionnel de santé</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <code className="bg-amber-50 px-3 py-1 rounded-lg text-sm font-mono text-amber-800 border border-amber-200">
                          {client.client_id}
                        </code>
                      </td>
                      <td className="p-5">
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <span>📧</span>
                              <span className="truncate max-w-[150px]">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <span>📱</span>
                              <span>{client.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <span>📍</span>
                          <span>{client.city || 'Non spécifié'}</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="font-semibold text-emerald-700">Actif</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="success" 
                            icon={<span>👁️</span>}
                            onClick={() => handleViewClient(client.id)}
                            className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          >
                            Voir
                          </Button>
                          <Button 
                            size="sm" 
                            variant="primary" 
                            icon={<span>✏️</span>}
                            onClick={() => handleEditClient(client.id)}
                            className="bg-amber-500 text-white border-0 hover:bg-orange-500"
                          >
                            Éditer
                          </Button>
                          <Button 
                            size="sm" 
                            variant="danger" 
                            icon={<span>🗑️</span>}
                            onClick={() => handleDeleteClient(client.id)}
                            className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          >
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
            merchantInfo={user}
          />
        )}

        {activeTab === 'invoices' && <InvoicesListPage merchantId={merchantId} />}

        {activeTab === 'notifications' && <NotificationsTab merchantId={merchantId} />}

        {activeTab === 'stock' && <StockManager merchantId={merchantId} />}

        {activeTab === 'settings' && <MerchantSettingsTab merchantId={merchantId} user={user} />}
      </Card>

      {/* Modale pour voir un produit */}
      <Modal
        isOpen={viewProductModalOpen}
        onClose={() => setViewProductModalOpen(false)}
        title="💊 Détails du médicament"
        icon="💊"
        size="lg"
        className="bg-gradient-to-br from-white to-slate-50"
      >
        {selectedProduct && (
          <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white text-4xl shadow-xl border border-white/20">
                💊
              </div>
              <div className="flex-1">
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-serif mb-2">
                  {selectedProduct.name}
                </div>
                <div className="text-sm text-slate-600 font-medium">
                  Code produit: <code className="bg-emerald-100 px-3 py-1 rounded-lg text-emerald-800 font-mono">{selectedProduct.id}</code>
                </div>
              </div>
            </div>

            {/* Prix */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-100">
              <div className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-2">
                Prix unitaire
              </div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent font-serif">
                {formatCurrency(selectedProduct.price)}
              </div>
            </div>

            {/* Description */}
            {selectedProduct.description && (
              <div>
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Description du médicament
                </div>
                <div className="p-4 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200 text-slate-700">
                  {selectedProduct.description}
                </div>
              </div>
            )}

            {/* Statut et informations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Statut commercial
                </div>
                <div className={`px-4 py-3 rounded-2xl text-center font-bold text-lg ${
                  selectedProduct.active 
                    ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-gradient-to-r from-rose-100 to-red-100 text-rose-800 border border-rose-200'
                }`}>
                  {selectedProduct.active ? '✅ Disponible' : '❌ Indisponible'}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  ID Établissement
                </div>
                <div className="p-3 bg-gradient-to-r from-slate-100 to-white rounded-2xl border border-slate-200 text-sm font-mono text-slate-700">
                  {selectedProduct.merchant_id}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="border-t border-slate-200 pt-6">
              <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                Informations de suivi
              </div>
              <div className="text-sm text-slate-600 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span>Création: {new Date(selectedProduct.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  <span>Dernière mise à jour: {new Date(selectedProduct.updated_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</div>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
              <Button
                variant="primary"
                icon={<span>✏️</span>}
                onClick={() => {
                  setViewProductModalOpen(false)
                  handleEditProduct(selectedProduct.id)
                }}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-lg hover:shadow-xl"
              >
                Modifier le médicament
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewProductModalOpen(false)}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale pour voir un client */}
      <Modal
        isOpen={viewClientModalOpen}
        onClose={() => setViewClientModalOpen(false)}
        title="👨‍⚕️ Détails du médecin"
        icon="👨‍⚕️"
        size="lg"
        className="bg-gradient-to-br from-white to-slate-50"
      >
        {selectedClient && (
          <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white text-4xl shadow-xl border border-white/20">
                👨‍⚕️
              </div>
              <div className="flex-1">
                <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent font-serif mb-2">
                  Dr. {selectedClient.name}
                </div>
                <div className="text-sm text-slate-600 font-medium">
                  ID Professionnel: <code className="bg-amber-100 px-3 py-1 rounded-lg text-amber-800 font-mono">{selectedClient.client_id}</code>
                </div>
              </div>
            </div>

            {/* Informations de contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Coordonnées professionnelles
                </div>
                <div className="space-y-3">
                  {selectedClient.email && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200">
                      <span className="text-amber-600 text-lg">📧</span>
                      <span className="text-sm text-slate-700 font-medium">{selectedClient.email}</span>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200">
                      <span className="text-amber-600 text-lg">📱</span>
                      <span className="text-sm text-slate-700 font-medium">{selectedClient.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Localisation
                </div>
                <div className="space-y-3">
                  {selectedClient.city && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200">
                      <span className="text-amber-600 text-lg">📍</span>
                      <span className="text-sm text-slate-700 font-medium">{selectedClient.city}</span>
                    </div>
                  )}
                  {selectedClient.address && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200">
                      <span className="text-amber-600 text-lg">🏥</span>
                      <span className="text-sm text-slate-700 font-medium">{selectedClient.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Informations commerciales */}
            <div className="border-t border-slate-200 pt-6">
              <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                Informations de facturation
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-100">
                  <div className="text-xs text-amber-700 font-semibold mb-2">Mode de paiement</div>
                  <div className="font-bold text-amber-800 text-lg">
                    {selectedClient.payment_mode || 'Non défini'}
                  </div>
                </div>
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-100">
                  <div className="text-xs text-emerald-700 font-semibold mb-2">Limite de crédit</div>
                  <div className="font-bold text-emerald-800 text-lg">
                    {selectedClient.credit_limit 
                      ? formatCurrency(selectedClient.credit_limit)
                      : 'Aucune limite'}
                  </div>
                </div>
              </div>
            </div>

            {/* Paramètres */}
            <div className="border-t border-slate-200 pt-6">
              <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                Préférences d'affichage
              </div>
              <div className="flex flex-wrap gap-3">
                <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                  selectedClient.show_price 
                    ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 border border-slate-300'
                }`}>
                  {selectedClient.show_price ? '💰 Prix visibles' : '💰 Prix masqués'}
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                  selectedClient.show_quantity 
                    ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 border border-slate-300'
                }`}>
                  {selectedClient.show_quantity ? '📊 Quantités visibles' : '📊 Quantités masquées'}
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
              <Button
                variant="primary"
                icon={<span>✏️</span>}
                onClick={() => {
                  setViewClientModalOpen(false)
                  handleEditClient(selectedClient.id)
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 shadow-lg hover:shadow-xl"
              >
                Modifier le médecin
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewClientModalOpen(false)}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </Button>
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
    </div>
  )
}
