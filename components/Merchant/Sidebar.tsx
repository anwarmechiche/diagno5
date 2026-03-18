'use client'

import type { LucideIcon } from 'lucide-react'
import {
  BellRing,
  Boxes,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './MerchantTheme.module.css'

interface SidebarProps {
  user: any
  onLogout: () => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  activeTab?: string
  setActiveTab?: (tab: string) => void
}

export default function Sidebar({
  user,
  onLogout,
  isOpen,
  setIsOpen,
  activeTab: activeTabProp,
  setActiveTab: setActiveTabProp,
}: SidebarProps) {
  const TAB_EVENT = useMemo(() => 'merchant:tab', [])
  const THEME_EVENT = useMemo(() => 'merchant:theme', [])

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeTab, setActiveTab] = useState<string>(activeTabProp || 'dashboard')

  useEffect(() => {
    if (activeTabProp) setActiveTab(activeTabProp)
  }, [activeTabProp])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('merchant_theme')
    const initial =
      stored === 'light' || stored === 'dark'
        ? (stored as 'light' | 'dark')
        : window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
          ? 'dark'
          : 'light'
    setTheme(initial)

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
  }, [TAB_EVENT, THEME_EVENT])

  const menuItems: Array<{ id: string; label: string; icon: LucideIcon }> = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'clients', label: 'Médecins', icon: Users },
    { id: 'orders', label: 'Commandes', icon: ShoppingCart },
    { id: 'invoices', label: 'Factures', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: BellRing },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ]

  const handleNavigation = (id: string) => {
    setActiveTab(id)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('merchant_active_tab', id)
      window.dispatchEvent(new CustomEvent(TAB_EVENT, { detail: { tabId: id } }))
    }
    if (typeof setActiveTabProp === 'function') setActiveTabProp(id)
    if (window.innerWidth < 1024) setIsOpen(false)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('merchant_theme', next)
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: next } }))
    }
  }

  return (
    <div className={styles.vars} data-theme={theme}>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setIsOpen(true)}
            className="fixed left-0 top-6 z-[60] flex h-10 w-10 items-center justify-center rounded-r-xl border border-slate-200/50 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-lg transition-all text-[#714B67] dark:text-emerald-400"
          >
            <Menu className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>      <motion.aside
        initial={false}
        animate={{ 
          x: isOpen ? 0 : -260,
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 border-r border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-black/40 backdrop-blur-[40px] transition-colors ${
          !isOpen && 'pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between p-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#714B67] to-[#5a3a52] flex items-center justify-center text-[10px] font-black text-white">
              DS
            </div>
            <span className="font-bold tracking-tight text-slate-800 dark:text-white text-sm">
              DIAGNO<span className="text-[#714B67] dark:text-emerald-400">SPHÈRE</span>
            </span>
          </div>
          {isOpen && (
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-hide">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigation(item.id)}
                className={`group relative flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-[12px] font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#714B67]/5 dark:bg-emerald-500/5 text-[#714B67] dark:text-emerald-400'
                    : 'text-slate-500 dark:text-zinc-500 hover:bg-slate-500/5 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 transition-all ${
                    isActive ? 'text-[#714B67] dark:text-emerald-400 scale-110' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="tracking-wide">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="proIndicator"
                    className="absolute left-0 w-1 h-5 bg-[#714B67] dark:bg-emerald-500 rounded-r-full"
                  />
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/50 dark:border-white/5 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-[#714B67]/10 dark:bg-emerald-500/10 flex items-center justify-center font-bold text-[11px] text-[#714B67] dark:text-emerald-400 border border-[#714B67]/20 dark:border-emerald-500/20">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase letter-spacing-wider">{user?.name || 'Admin'}</p>
            </div>
            <button
               onClick={toggleTheme}
               className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
               {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[11px] font-bold text-red-500 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </motion.aside>
    </div>
  )
}
