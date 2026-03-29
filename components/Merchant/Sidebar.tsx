'use client'

import type { LucideIcon } from 'lucide-react'
import {
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
    <>
      {!isOpen && (
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--cardStrong)] backdrop-blur-md shadow-2xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accentBorder)]"
        >
          <Menu className="h-5 w-5 text-[color:var(--text)]" />
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[color:var(--border)] bg-[color:var(--cardStrong)] backdrop-blur-md transition-all duration-300 ease-in-out ${
          isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border)] p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[color:var(--accentSolid)] text-[10px] font-black text-[color:var(--accentOn)]">
              DS
            </div>
            <span className="font-bold tracking-tight text-[color:var(--text)]">
              DIAGNO<span className="text-[color:var(--accentSolid)]">SPHÈRE</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--textMuted)] hover:bg-[color:var(--accentBg)] hover:text-[color:var(--text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accentBorder)]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--textMuted)] hover:bg-[color:var(--accentBg)] hover:text-[color:var(--text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accentBorder)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleNavigation(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--accentBorder)] ${
                  isActive
                    ? 'border-[color:var(--accentBorder)] bg-[color:var(--accentBg)] text-[color:var(--text)]'
                    : 'border-transparent text-[color:var(--textMuted)] hover:border-[color:var(--border)] hover:bg-[color:var(--card)] hover:text-[color:var(--text)]'
                }`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-[color:var(--accentSolid)]' : 'text-[color:var(--textMuted)]'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-[color:var(--border)] p-3">
          <div className="flex items-center gap-2 rounded-lg bg-[color:var(--card)] p-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--accentBorder)] bg-[color:var(--accentBg)] text-[10px] font-bold text-[color:var(--accentSolid)]">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <p className="truncate text-xs font-semibold text-[color:var(--text)]">{user?.name || 'Admin'}</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[color:var(--gold)] transition-colors hover:bg-[rgba(201,168,76,0.12)]"
          >
            <LogOut className="h-4 w-4" />
            <span>Quitter</span>
          </button>
        </div>
      </aside>
    </>
    </div>
  )
}
