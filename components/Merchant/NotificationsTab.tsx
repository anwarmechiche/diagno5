'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import { BellRing, CheckCheck, RefreshCw } from 'lucide-react'

type MerchantNotification = {
  id: string | number
  merchant_id?: string | number
  client_id?: string | number | null
  title?: string | null
  message?: string | null
  created_at?: string | null
  read?: boolean | null
}

export default function NotificationsTab({ merchantId }: { merchantId: string }) {
  const channelName = useMemo(() => `notifications-${merchantId}`, [merchantId])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<MerchantNotification[]>([])
  const [markingAll, setMarkingAll] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)

  const isMissingTableError = (e: any) => {
    const msg = String(e?.message || '')
    return msg.includes("schema cache") || msg.includes("public.notifications") || msg.includes("notifications")
  }

  const fetchOrdersFallback = async () => {
    const [{ data: ordersData, error: ordersError }, { data: clientsData }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, client_id, merchant_id, order_group_id, created_at, status')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('clients').select('id, name, email').eq('merchant_id', merchantId),
    ])

    if (ordersError) throw ordersError

    const clientNameById = new Map<string, string>()
    for (const c of (clientsData as any[]) || []) {
      clientNameById.set(String(c.id), String(c.name || c.email || 'Client'))
    }

    const map = new Map<string, MerchantNotification>()
    for (const o of (ordersData as any[]) || []) {
      const groupId = String(o.order_group_id || `CMD-${String(o.id).slice(-6)}`)
      const existing = map.get(groupId)
      const createdAt = String(o.created_at || new Date().toISOString())
      const clientName = clientNameById.get(String(o.client_id)) || `Client #${String(o.client_id)}`
      const next: MerchantNotification = existing
        ? {
            ...existing,
            message: `${existing.message || ''}`,
          }
        : {
            id: groupId,
            title: 'Nouvelle commande',
            message: `${clientName} — ${groupId}`,
            created_at: createdAt,
            read: false,
          }

      // incrémenter compteur dans le message
      const m = String(next.message || '')
      const countMatch = m.match(/\((\d+)\s+ligne\(s\)\)$/)
      const count = countMatch ? Number(countMatch[1]) + 1 : 1
      next.message = `${clientName} — ${groupId} (${count} ligne(s))`
      next.created_at = createdAt

      map.set(groupId, next)
    }

    setItems(
      Array.from(map.values()).sort(
        (a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime()
      )
    )
  }

  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setTableMissing(false)
      setItems((data as any) || [])
    } catch (e: any) {
      console.error('Fetch notifications failed', e)
      if (isMissingTableError(e)) {
        setTableMissing(true)
        setError(null)
        try {
          await fetchOrdersFallback()
        } catch (fallbackErr: any) {
          setError(fallbackErr?.message || 'Impossible de charger les notifications')
          setItems([])
        }
      } else {
        setError(e?.message || 'Impossible de charger les notifications')
        setItems([])
      }
    } finally {
      setLoading(false)
    }
  }

  const markAllAsRead = async () => {
    if (tableMissing) return
    try {
      setMarkingAll(true)
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('merchant_id', merchantId)
        .eq('read', false)

      if (error) throw error
      await fetchNotifications()
    } catch (e: any) {
      console.error('Mark all read failed', e)
      alert(e?.message || 'Impossible de marquer comme lu')
    } finally {
      setMarkingAll(false)
    }
  }

  const markOneAsRead = async (id: string | number) => {
    if (tableMissing) return
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
      if (error) throw error
      setItems((prev) => prev.map((n) => (String(n.id) === String(id) ? { ...n, read: true } : n)))
    } catch (e: any) {
      console.error('Mark read failed', e)
      alert(e?.message || 'Impossible de marquer comme lu')
    }
  }

  useEffect(() => {
    if (!merchantId) return
    fetchNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  useEffect(() => {
    if (!merchantId) return

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `merchant_id=eq.${merchantId}` },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `merchant_id=eq.${merchantId}` },
        () => fetchNotifications()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel).catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, channelName])

  const unread = items.filter((n) => !n.read).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accentBg)] text-[color:var(--accentSolid)]">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[color:var(--text)]">Notifications</h2>
            <p className="text-sm text-[color:var(--textMuted)]">
              {unread > 0 ? `${unread} non lue(s)` : 'Tout est à jour'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchNotifications} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>
            Rafraîchir
          </Button>
          <Button
            variant="secondary"
            onClick={markAllAsRead}
            loading={markingAll}
            disabled={tableMissing || unread === 0}
            icon={<CheckCheck className="h-4 w-4" />}
          >
            Tout marquer lu
          </Button>
        </div>
      </div>

      {tableMissing && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm text-[color:var(--textMuted)]">
          La table <span className="font-mono text-[color:var(--text)]">public.notifications</span> n’existe pas dans Supabase.
          Affichage en mode “commandes récentes” (fallback). Les emails restent envoyés même hors ligne.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 text-center text-[color:var(--textMuted)]">
          Chargement des notifications...
        </div>
      )}

      {!loading && !items.length && !error && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-10 text-center">
          <div className="text-sm font-semibold text-[color:var(--textMuted)]">Aucune notification</div>
          <div className="mt-2 text-xs text-[color:var(--textMuted)]">
            Les nouvelles commandes et mises à jour s’afficheront ici.
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
          <ul className="divide-y divide-[color:var(--border)]">
            {items.map((n) => {
              const isUnread = !n.read
              return (
                <li
                  key={String(n.id)}
                  className={`p-4 sm:p-5 ${isUnread ? 'bg-[color:var(--accentBg)]/60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            isUnread ? 'bg-[color:var(--accentSolid)]' : 'bg-[color:var(--border)]'
                          }`}
                        />
                        <div className="truncate font-bold text-[color:var(--text)]">{n.title || 'Notification'}</div>
                      </div>
                      <div className="mt-2 text-sm text-[color:var(--textMuted)]">{n.message || ''}</div>
                      <div className="mt-2 text-xs text-[color:var(--textMuted)]">
                        {n.created_at ? new Date(n.created_at).toLocaleString('fr-FR') : ''}
                      </div>
                    </div>
                    {isUnread && (
                      <Button variant="outline" size="sm" onClick={() => markOneAsRead(n.id)}>
                        Marquer lu
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
