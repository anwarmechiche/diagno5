'use client'

import { useState } from 'react'
import { Product, Client, MerchantSettings, Order } from '@/utils/supabase/types'
import { motion, AnimatePresence } from 'framer-motion'

import { Package, Calendar, Clock, Eye, X, Printer } from 'lucide-react'

interface OrderDetails {
  groupId: string
  date: string
  status: string
  orders: Order[]
  totalAmount: number
  merchantInfo?: MerchantSettings
  clientInfo: Client
}

interface ClientOrdersProps {
  orderGroups: Array<{
    id: string
    date: string
    status: string
    orders: Order[]
  }>
  products: Product[]
  client: Client
  merchantSettings: MerchantSettings | null
  formatCurrency: (value: number) => string
  onOpenOrderDetails: (group: any) => void
  selectedOrder: OrderDetails | null
  showOrderDetails: boolean
  onCloseOrderDetails: () => void
  onGeneratePDF: (orderDetails: OrderDetails) => void
}

export default function ClientOrders({
  orderGroups,
  products,
  client,
  merchantSettings,
  formatCurrency,
  onOpenOrderDetails,
  selectedOrder,
  showOrderDetails,
  onCloseOrderDetails,
  onGeneratePDF
}: ClientOrdersProps) {
  const normalizeOrderRef = (raw: string) => {
    const value = String(raw || '').trim()
    if (!value) return 'CMD-0000'
    if (/^cmd-\d{4}$/i.test(value) || /^CMD-\d{4}$/i.test(value)) return value.toUpperCase()
    const digits = value.replace(/\D/g, '')
    if (!digits) return 'CMD-0000'
    return `CMD-${digits.slice(-4).padStart(4, '0')}`
  }

  return (
    <div className="space-y-6">
      {orderGroups.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-50 dark:bg-[#050505] rounded-3xl border dark:border-[#1f1f1f]">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-bold mb-2">Aucune commande</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderGroups.map((group, i) => {
            const date = new Date(group.date)
            const rawRef = String(group.id || '')
            const displayRef = normalizeOrderRef(rawRef)
            const totalAmount = group.orders.reduce((sum, order) => {
              const product = products.find(p => String(p.id) === String(order.product_id))
              return sum + (product?.price || 0) * order.quantity
            }, 0)
            
            return (
              <motion.div 
                key={group.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/95 dark:bg-[#050505] border border-slate-200/70 dark:border-[#1f1f1f] rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all cursor-pointer group"
                onClick={() => onOpenOrderDetails(group)}
              >
                <div className="p-6 border-b border-slate-200/70 dark:border-[#1f1f1f] bg-gradient-to-r from-emerald-50/80 via-white/40 to-transparent dark:from-[#1f1f1f]/60">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Package className="w-5 h-5 text-emerald-500" />
                        <p className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 font-black">Commande #{displayRef}</p>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-lg"><Calendar className="w-3.5 h-3.5" /> {date.toLocaleDateString('fr-FR')}</span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-lg"><Clock className="w-3.5 h-3.5" /> {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        group.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-orange-500/10 text-orange-500 border border-orange-500/30'
                      }`}>
                         {group.status === 'delivered' ? 'Livrée' : 'En attente'}
                      </span>
                      {client.show_price !== false && (
                        <p className="text-xl font-black text-emerald-500 mono">{formatCurrency(totalAmount)}</p>
                      )}
                      <Eye className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all" />
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {group.orders.slice(0, 3).map((order) => {
                      const product = products.find(p => String(p.id) === String(order.product_id))
                      return (
                        <div key={order.id} className="flex items-center gap-2 bg-slate-50 dark:bg-white/3 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{product?.name || 'Produit'}</span>
                          <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 rounded-md">x{order.quantity}</span>
                        </div>
                      )
                    })}
                    {group.orders.length > 3 && (
                      <div className="bg-slate-50 dark:bg-white/3 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5">
                        <span className="text-[11px] font-black text-slate-400">+{group.orders.length - 3}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Modal Détails commande */}      <AnimatePresence>
        {showOrderDetails && selectedOrder && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
              onClick={onCloseOrderDetails}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 rounded-[2.5rem] max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 flex flex-col"
            >
              <div className="p-8 border-b dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-black/20 backdrop-blur-xl">
                <div>
                  <h2 className="font-black text-xl uppercase tracking-tighter">Détails Commande</h2>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Référence: {selectedOrder.groupId}</p>
                </div>
                <button onClick={onCloseOrderDetails} className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 overflow-y-auto flex-1 scrollbar-hide">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-white/3 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fournisseur</p>
                    <p className="font-black text-sm">{merchantSettings?.company_name || 'TradePro'}</p>
                    {merchantSettings?.company_phone && <p className="text-xs font-bold text-slate-500 mt-1">{merchantSettings.company_phone}</p>}
                  </div>
                  <div className="bg-slate-50 dark:bg-white/3 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Client Medecin</p>
                    <p className="font-black text-sm">{selectedOrder.clientInfo.name}</p>
                    {selectedOrder.clientInfo.email && <p className="text-xs font-bold text-slate-500 mt-1 truncate">{selectedOrder.clientInfo.email}</p>}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Articles</p>
                  {selectedOrder.orders.map((order) => {
                    const product = products.find(p => String(p.id) === String(order.product_id))
                    return (
                      <div key={order.id} className="flex justify-between items-center p-4 bg-white dark:bg-white/3 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center font-black text-emerald-500 text-xs">
                            {order.quantity}
                          </div>
                          <div>
                            <p className="font-black text-sm">{product?.name || 'Produit'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formatCurrency(product?.price || 0)} p.u</p>
                          </div>
                        </div>
                        <p className="font-black text-emerald-500 mono">{formatCurrency((product?.price || 0) * order.quantity)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 dark:bg-black/20 backdrop-blur-xl border-t dark:border-white/5">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de la commande</p>
                  <p className="text-3xl font-black text-emerald-500 mono">{formatCurrency(selectedOrder.totalAmount)}</p>
                </div>
                
                <button 
                  onClick={() => onGeneratePDF(selectedOrder)} 
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  <Printer className="w-5 h-5" /> Télécharger le Bon
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
