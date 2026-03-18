'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Merchant/Sidebar'
import MerchantDashboard from '@/components/Merchant/MerchantDashboard'
import { clearSession, getSession } from '@/lib/auth-helpers'
import styles from '@/components/Merchant/MerchantTheme.module.css'

export default function FournisseurPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const data = getSession()
    if (!data) {
      router.push('/')
    } else {
      setSession(data)
    }
  }, [router])

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

    const THEME_EVENT = 'merchant:theme'
    const onTheme = (event: Event) => {
      const custom = event as CustomEvent<{ theme?: 'dark' | 'light' }>
      const next = custom?.detail?.theme
      if (next === 'dark' || next === 'light') setTheme(next)
    }
    window.addEventListener(THEME_EVENT, onTheme)
    return () => window.removeEventListener(THEME_EVENT, onTheme)
  }, [])

  const handleLogout = () => {
    clearSession()
    router.push('/')
  }

  if (!session) return <div className="bg-black h-screen" />

  return (
    <div className={`${styles.theme} ${styles.vars} flex h-screen overflow-hidden font-sans`} data-theme={theme}>
      <Sidebar
        user={session.user}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className={`flex-1 overflow-y-auto relative custom-scrollbar transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        <MerchantDashboard
          merchantId={session.merchantId}
          user={session.user}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </main>
    </div>
  )
}
