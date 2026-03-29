'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  CalendarRange,
  Download,
  Filter,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X
} from 'lucide-react'
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays
} from 'date-fns'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { db } from '@/utils/supabase/client'

interface StatBIProps {
  merchantId: string
}

type DatePreset = '7d' | '30d' | '90d' | '365d' | 'custom' | 'all'
type Granularity = 'day' | 'week' | 'month'
type SeriesMode = 'revenue' | 'orders'

type OrderStatus = 'pending' | 'processing' | 'validated' | 'delivered' | 'cancelled' | 'other'

type ProductLike = {
  id: string | number
  name?: string | null
  price?: number | null
  active?: boolean | null
  stock_quantity?: number | null
  min_stock_level?: number | null
}

type ClientLike = {
  id: string | number
  name?: string | null
}

type OrderLike = {
  id: string | number
  product_id: string | number
  client_id: string | number
  quantity?: number | null
  status?: string | null
  created_at: string
  order_group_id?: string | null
}

type EnrichedLine = {
  id: string
  groupId: string
  createdAt: Date
  createdAtISO: string
  status: OrderStatus
  productId: string
  productName: string
  clientId: string
  clientName: string
  quantity: number
  unitPrice: number
  revenue: number
}

type TimePoint = {
  key: string
  label: string
  revenue: number
  orders: number
}

const STATUS_META: Record<OrderStatus, { label: string; dot: string; chip: string; chart: string }> = {
  pending: {
    label: 'En attente',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    chart: '#f59e0b'
  },
  processing: {
    label: 'En cours',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    chart: '#3b82f6'
  },
  validated: {
    label: 'Validée',
    dot: 'bg-[#714B67]',
    chip: 'bg-[#f5f0f3] text-[#714B67] border-[#e9d5e2]',
    chart: '#714B67'
  },
  delivered: {
    label: 'Livrée',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    chart: '#10b981'
  },
  cancelled: {
    label: 'Annulée',
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    chart: '#f43f5e'
  },
  other: {
    label: 'Autre',
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    chart: '#94a3b8'
  }
}

const formatDateInput = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const parseLocalDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const safeDivide = (num: number, den: number) => (den === 0 ? 0 : num / den)

const normalizeStatus = (raw?: string | null): OrderStatus => {
  const value = String(raw || '').toLowerCase().trim()
  if (value === 'pending') return 'pending'
  if (value === 'processing') return 'processing'
  if (value === 'validated') return 'validated'
  if (value === 'delivered') return 'delivered'
  if (value === 'cancelled' || value === 'canceled') return 'cancelled'
  return 'other'
}

const formatCompactNumber = (value: number) => {
  return new Intl.NumberFormat('fr-DZ', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)
}

const formatPercent = (value: number) => {
  return new Intl.NumberFormat('fr-DZ', { style: 'percent', maximumFractionDigits: 0 }).format(value || 0)
}

const formatShortDate = (date: Date) => {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date)
}

const formatLongDateTime = (date: Date) => {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const getBucketKey = (date: Date, granularity: Granularity) => {
  if (granularity === 'day') return formatDateInput(date)
  if (granularity === 'week') return formatDateInput(startOfWeek(date, { weekStartsOn: 1 }))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const getBucketLabel = (date: Date, granularity: Granularity) => {
  if (granularity === 'day') return formatShortDate(date)
  if (granularity === 'week') {
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    return `Semaine ${formatShortDate(monday)}`
  }
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(date)
}

const stepBucket = (date: Date, granularity: Granularity) => {
  if (granularity === 'day') return addDays(date, 1)
  if (granularity === 'week') return addDays(date, 7)
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function KpiCard({
  title,
  value,
  subValue,
  icon,
  delta
}: {
  title: string
  value: string
  subValue?: string
  icon: ReactNode
  delta?: { value: number; label: string } | null
}) {
  const isUp = (delta?.value || 0) >= 0
  const DeltaIcon = isUp ? TrendingUp : TrendingDown
  const deltaColor = isUp
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : 'text-rose-700 bg-rose-50 border-rose-200'

  return (
    <Card className="p-5 border border-gray-200 bg-white hover:border-[#714B67]/30 transition-all duration-300 shadow-sm group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-bold text-[#6B6B6B] uppercase tracking-widest">{title}</div>
          <div className="mt-2 text-2xl text-[#2C2C2C] font-semibold truncate">{value}</div>
          {subValue && <div className="mt-1 text-[11px] text-[#9B9B9B]">{subValue}</div>}
        </div>
        <div className="flex flex-col items-end gap-2 text-[#714B67]">
          <div className="h-12 w-12 rounded-xl bg-[#f5f0f3] border border-[#e9d5e2] text-[#714B67] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            {icon}
          </div>
          {delta && (
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider ${deltaColor}`}>
              <DeltaIcon className="h-3 w-3" />
              {formatPercent(Math.abs(delta.value))} {delta.label}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function BarList({
  title,
  subtitle,
  rows,
  onPick,
  valueFormatter
}: {
  title: string
  subtitle?: string
  rows: { id: string; label: string; value: number; secondary?: string }[]
  onPick?: (id: string) => void
  valueFormatter?: (value: number) => string
}) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.value), 0) || 1

  return (
    <Card className="p-6 border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4 border-b border-gray-100 pb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#6B6B6B] uppercase tracking-widest">{title}</h3>
          {subtitle && <p className="text-xs text-[#9B9B9B] mt-1">{subtitle}</p>}
        </div>
        <div className="text-xs font-mono text-[#714B67] bg-[#f5f0f3] px-2 py-1 rounded border border-[#e9d5e2]">{rows.length} élément(s)</div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-sm text-gray-400">Aucune donnée.</div>
        ) : (
          rows.map((row) => {
            const pct = clamp((row.value / max) * 100, 0, 100)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onPick?.(row.id)}
                className={`w-full text-left rounded-xl border border-gray-100 bg-[#F9FAFB] p-4 hover:border-[#714B67]/30 hover:bg-white transition-all duration-300 shadow-sm ${
                  onPick ? 'cursor-pointer' : 'cursor-default'
                }`}
                disabled={!onPick}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#2C2C2C] truncate tracking-wide">{row.label}</div>
                    {row.secondary && <div className="text-[11px] text-[#6B6B6B] mt-1">{row.secondary}</div>}
                  </div>
                  <div className="text-lg text-[#714B67] font-bold whitespace-nowrap">
                    {valueFormatter ? valueFormatter(row.value) : formatCompactNumber(row.value)}
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#714B67] to-[#9b688c]" style={{ width: `${pct}%` }} />
                </div>
              </button>
            )
          })
        )}
      </div>
    </Card>
  )
}

function DonutChart({
  title,
  subtitle,
  segments,
  onToggle
}: {
  title: string
  subtitle?: string
  segments: { key: OrderStatus; value: number; active: boolean }[]
  onToggle?: (status: OrderStatus) => void
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  const activeTotal = segments.filter(s => s.active).reduce((sum, s) => sum + s.value, 0) || total

  const gradient = (() => {
    let acc = 0
    const parts: string[] = []
    segments.forEach((segment) => {
      const pct = (segment.value / total) * 100
      const from = acc
      const to = acc + pct
      acc = to
      const color = segment.active ? STATUS_META[segment.key].chart : '#e2e8f0'
      parts.push(`${color} ${from.toFixed(2)}% ${to.toFixed(2)}%`)
    })
    return `conic-gradient(${parts.join(', ')})`
  })()

  return (
    <Card className="p-6 border border-gray-200 bg-white shadow-sm h-full">
      <div className="flex items-start justify-between gap-3 mb-6 border-b border-gray-100 pb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#6B6B6B] uppercase tracking-widest">{title}</h3>
          {subtitle && <p className="text-xs text-[#9B9B9B] mt-1">{subtitle}</p>}
        </div>
        <div className="text-xs font-mono text-[#714B67] bg-[#f5f0f3] px-2 py-1 rounded border border-[#e9d5e2]">
          {formatCompactNumber(activeTotal)} / {formatCompactNumber(total)}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-4 rounded-full bg-white border border-gray-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xs font-bold text-[#9B9B9B] uppercase tracking-widest">Total</div>
              <div className="text-2xl text-[#2C2C2C] font-semibold">{formatCompactNumber(activeTotal)}</div>
            </div>
          </div>
        </div>

        <div className="w-full grid grid-cols-1 gap-2">
          {segments.map((segment) => {
            const meta = STATUS_META[segment.key]
            const pct = safeDivide(segment.value, total)
            return (
              <button
                key={segment.key}
                type="button"
                onClick={() => onToggle?.(segment.key)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${
                  segment.active
                    ? 'border-gray-200 bg-white hover:bg-gray-50'
                    : 'border-gray-100 bg-gray-50 text-gray-400 opacity-60'
                }`}
                disabled={!onToggle}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full ${segment.active ? meta.dot : 'bg-gray-300'}`} />
                  <span className="text-sm font-semibold text-gray-700">{meta.label}</span>
                  <span className="text-xs text-gray-400 truncate">{formatPercent(pct)}</span>
                </div>
                <div className="text-sm text-[#714B67] font-bold">{formatCompactNumber(segment.value)}</div>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function AreaChart({
  title,
  subtitle,
  points,
  mode,
  formatValue
}: {
  title: string
  subtitle?: string
  points: TimePoint[]
  mode: SeriesMode
  formatValue: (value: number) => string
}) {
  const chartId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const values = points.map(p => (mode === 'revenue' ? p.revenue : p.orders))
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? 50 : (i * 100) / (points.length - 1)
    const value = mode === 'revenue' ? p.revenue : p.orders
    const y = 38 - ((value - min) / span) * 32
    return { x, y: clamp(y, 4, 38) }
  })

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L 100 40 L 0 40 Z`

  const hoveredPoint = hoverIndex === null ? null : points[hoverIndex]

  return (
    <Card className="p-6 border border-gray-200 bg-white shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#6B6B6B] uppercase tracking-widest">{title}</h3>
          {subtitle && <p className="text-xs text-[#9B9B9B] mt-1">{subtitle}</p>}
        </div>
        {hoveredPoint && (
          <div className="text-right bg-gray-50 p-2 rounded-lg border border-gray-100">
            <div className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-wider">{hoveredPoint.label}</div>
            <div className="text-lg text-[#714B67] font-bold leading-none mt-1">
              {mode === 'revenue' ? formatValue(hoveredPoint.revenue) : formatCompactNumber(hoveredPoint.orders)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex-1 relative min-h-[200px]">
        <svg viewBox="0 0 100 40" className="w-full h-40">
          <defs>
            <linearGradient id={`area-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#714B67" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#714B67" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill={`url(#area-${chartId})`} />
          <path d={linePath} fill="none" stroke="#714B67" strokeWidth="1" />

          {coords.map((c, idx) => (
            <circle
              key={idx}
              cx={c.x}
              cy={c.y}
              r={hoverIndex === idx ? 1.5 : 0.8}
              fill={hoverIndex === idx ? '#714B67' : '#9b688c'}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          ))}
        </svg>

        {hoverIndex !== null && (
          <div
            className="absolute -top-1 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-[10px] z-20"
            style={{
              left: `${coords[hoverIndex]?.x || 0}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-bold text-[#2C2C2C]">{points[hoverIndex]?.label}</div>
            <div className="text-[#6B6B6B]">
              {mode === 'revenue'
                ? formatValue(points[hoverIndex]?.revenue || 0)
                : `${formatCompactNumber(points[hoverIndex]?.orders || 0)} commandes`}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default function StatBI({ merchantId }: StatBIProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const [products, setProducts] = useState<ProductLike[]>([])
  const [clients, setClients] = useState<ClientLike[]>([])
  const [orders, setOrders] = useState<OrderLike[]>([])

  const [datePreset, setDatePreset] = useState<DatePreset>('30d')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [seriesMode, setSeriesMode] = useState<SeriesMode>('revenue')
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>([])
  const [productFilter, setProductFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')

  const loadData = async () => {
    if (!merchantId) return
    setLoading(true)
    setError(null)
    try {
      const [productsData, clientsData, ordersData] = await Promise.all([
        db.getProducts(merchantId),
        db.getClients(merchantId),
        db.getOrders(merchantId)
      ])

      setProducts((productsData as any[]) || [])
      setClients((clientsData as any[]) || [])
      setOrders((ordersData as any[]) || [])
      setLastUpdatedAt(new Date())
    } catch (err: any) {
      console.error('Erreur chargement stats:', err)
      setError(err?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  useEffect(() => {
    const now = new Date()
    if (datePreset === 'all') {
      setDateFrom('')
      setDateTo('')
      return
    }
    if (datePreset === 'custom') {
      if (!dateFrom) setDateFrom(formatDateInput(subDays(now, 29)))
      if (!dateTo) setDateTo(formatDateInput(now))
      return
    }

    const presetDays: Record<Exclude<DatePreset, 'custom' | 'all'>, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '365d': 365
    }

    const days = presetDays[datePreset]
    setDateFrom(formatDateInput(subDays(now, days - 1)))
    setDateTo(formatDateInput(now))
  }, [datePreset])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  const productsById = useMemo(() => {
    const map = new Map<string, ProductLike>()
    products.forEach((p) => map.set(String(p.id), p))
    return map
  }, [products])

  const clientsById = useMemo(() => {
    const map = new Map<string, ClientLike>()
    clients.forEach((c) => map.set(String(c.id), c))
    return map
  }, [clients])

  const resolvedRange = useMemo(() => {
    if (datePreset === 'all') return { start: null as Date | null, end: null as Date | null }

    const start = parseLocalDate(dateFrom)
    const end = parseLocalDate(dateTo)
    if (!start || !end) {
      const fallbackEnd = endOfDay(new Date())
      const fallbackStart = startOfDay(subDays(fallbackEnd, 29))
      return { start: fallbackStart, end: fallbackEnd }
    }

    const s = startOfDay(start)
    const e = endOfDay(end)
    if (e.getTime() < s.getTime()) return { start: startOfDay(end), end: endOfDay(start) }
    return { start: s, end: e }
  }, [dateFrom, dateTo, datePreset])

  const enrichedLines = useMemo<EnrichedLine[]>(() => {
    return (orders || []).map((order) => {
      const orderAny = order as any
      const createdAt = new Date(order.created_at)
      const groupId = String(orderAny.order_group_id || `order-${order.id}`)
      const productId = String(order.product_id)
      const clientId = String(order.client_id)
      const product = productsById.get(productId)
      const client = clientsById.get(clientId)

      const quantity = Number(order.quantity || 0) || 0
      const unitPrice = Number(product?.price || 0) || 0
      const revenue = quantity * unitPrice

      return {
        id: String(order.id),
        groupId,
        createdAt,
        createdAtISO: order.created_at,
        status: normalizeStatus(order.status),
        productId,
        productName: product?.name ? String(product.name) : `Produit #${productId.slice(-4)}`,
        clientId,
        clientName: client?.name ? String(client.name) : `Client #${clientId.slice(-4)}`,
        quantity,
        unitPrice,
        revenue
      }
    })
  }, [orders, productsById, clientsById])

  const filteredLines = useMemo(() => {
    const { start, end } = resolvedRange
    return enrichedLines.filter((line) => {
      if (start && end) {
        const t = line.createdAt.getTime()
        if (t < start.getTime() || t > end.getTime()) return false
      }
      if (statusFilter.length > 0 && !statusFilter.includes(line.status)) return false
      if (productFilter !== 'all' && String(productFilter) !== line.productId) return false
      if (clientFilter !== 'all' && String(clientFilter) !== line.clientId) return false
      return true
    })
  }, [clientFilter, enrichedLines, productFilter, resolvedRange, statusFilter])

  const previousPeriodLines = useMemo(() => {
    const { start, end } = resolvedRange
    if (!start || !end) return [] as EnrichedLine[]

    const days = differenceInCalendarDays(end, start) + 1
    if (days <= 0) return [] as EnrichedLine[]

    const prevEnd = endOfDay(subDays(start, 1))
    const prevStart = startOfDay(subDays(start, days))

    return enrichedLines.filter((line) => {
      const t = line.createdAt.getTime()
      if (t < prevStart.getTime() || t > prevEnd.getTime()) return false
      if (statusFilter.length > 0 && !statusFilter.includes(line.status)) return false
      if (productFilter !== 'all' && String(productFilter) !== line.productId) return false
      if (clientFilter !== 'all' && String(clientFilter) !== line.clientId) return false
      return true
    })
  }, [clientFilter, enrichedLines, productFilter, resolvedRange, statusFilter])

  const derived = useMemo(() => {
    const groupMap = new Map<
      string,
      { id: string; createdAt: Date; clientId: string; revenue: number; quantity: number; statuses: Set<OrderStatus> }
    >()

    filteredLines.forEach((line) => {
      if (!groupMap.has(line.groupId)) {
        groupMap.set(line.groupId, {
          id: line.groupId,
          createdAt: line.createdAt,
          clientId: line.clientId,
          revenue: 0,
          quantity: 0,
          statuses: new Set<OrderStatus>()
        })
      }
      const group = groupMap.get(line.groupId)!
      group.revenue += line.revenue
      group.quantity += line.quantity
      group.statuses.add(line.status)
      if (line.createdAt.getTime() > group.createdAt.getTime()) group.createdAt = line.createdAt
    })

    const groups = Array.from(groupMap.values()).map((g) => {
      const status = g.statuses.has('cancelled')
        ? 'cancelled'
        : g.statuses.has('processing')
          ? 'processing'
          : g.statuses.has('pending')
            ? 'pending'
            : g.statuses.has('validated')
              ? 'validated'
              : g.statuses.has('delivered')
                ? 'delivered'
                : 'other'

      return {
        ...g,
        status
      }
    })

    const revenue = filteredLines.reduce((sum, l) => sum + l.revenue, 0)
    const linesCount = filteredLines.length
    const ordersCount = groups.length
    const itemsCount = filteredLines.reduce((sum, l) => sum + l.quantity, 0)
    const activeClients = new Set(groups.map(g => g.clientId)).size
    const aov = safeDivide(revenue, Math.max(1, ordersCount))

    const deliveredOrders = groups.filter(g => g.status === 'delivered').length
    const deliveryRate = safeDivide(deliveredOrders, Math.max(1, ordersCount))

    const prevRevenue = previousPeriodLines.reduce((sum, l) => sum + l.revenue, 0)
    const prevOrdersCount = new Set(previousPeriodLines.map(l => l.groupId)).size
    const prevClientsCount = (() => {
      const groupClients = new Map<string, string>()
      previousPeriodLines.forEach((line) => {
        if (!groupClients.has(line.groupId)) groupClients.set(line.groupId, line.clientId)
      })
      return new Set(Array.from(groupClients.values())).size
    })()
    const prevAov = safeDivide(prevRevenue, Math.max(1, prevOrdersCount))

    const deltas = {
      revenue: prevRevenue ? (revenue - prevRevenue) / prevRevenue : 0,
      orders: prevOrdersCount ? (ordersCount - prevOrdersCount) / prevOrdersCount : 0,
      clients: prevClientsCount ? (activeClients - prevClientsCount) / prevClientsCount : 0,
      aov: prevAov ? (aov - prevAov) / prevAov : 0
    }

    return {
      revenue,
      linesCount,
      ordersCount,
      itemsCount,
      activeClients,
      aov,
      deliveryRate,
      deltas,
      groups: groups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }
  }, [filteredLines, previousPeriodLines])

  const statusSegments = useMemo(() => {
    const counts = new Map<OrderStatus, number>()
    filteredLines.forEach((line) => counts.set(line.status, (counts.get(line.status) || 0) + 1))

    const segments: { key: OrderStatus; value: number; active: boolean }[] = (Object.keys(STATUS_META) as OrderStatus[]).map((key) => ({
      key,
      value: counts.get(key) || 0,
      active: statusFilter.length === 0 ? true : statusFilter.includes(key)
    }))

    return segments.sort((a, b) => b.value - a.value)
  }, [filteredLines, statusFilter])

  const effectiveGranularity = useMemo(() => {
    const { start, end } = resolvedRange
    if (!start || !end) return granularity

    const days = differenceInCalendarDays(end, start) + 1
    if (days > 365 && granularity === 'day') return 'week' as Granularity
    if (days > 730) return 'month' as Granularity
    return granularity
  }, [granularity, resolvedRange])

  const timeline = useMemo<TimePoint[]>(() => {
    const { start, end } = resolvedRange

    let rangeStart = start
    let rangeEnd = end

    if (!rangeStart || !rangeEnd) {
      if (filteredLines.length === 0) return []
      const min = filteredLines.reduce(
        (acc, l) => (l.createdAt.getTime() < acc.getTime() ? l.createdAt : acc),
        filteredLines[0].createdAt
      )
      const max = filteredLines.reduce(
        (acc, l) => (l.createdAt.getTime() > acc.getTime() ? l.createdAt : acc),
        filteredLines[0].createdAt
      )
      rangeStart = startOfDay(min)
      rangeEnd = endOfDay(max)
    }

    const normalizedStart =
      effectiveGranularity === 'day'
        ? startOfDay(rangeStart)
        : effectiveGranularity === 'week'
          ? startOfWeek(rangeStart, { weekStartsOn: 1 })
          : startOfMonth(rangeStart)

    const normalizedEnd = endOfDay(rangeEnd)

    const buckets = new Map<string, { revenue: number; orderGroups: Set<string> }>()
    filteredLines.forEach((line) => {
      const key = getBucketKey(line.createdAt, effectiveGranularity)
      if (!buckets.has(key)) buckets.set(key, { revenue: 0, orderGroups: new Set<string>() })
      const bucket = buckets.get(key)!
      bucket.revenue += line.revenue
      bucket.orderGroups.add(line.groupId)
    })

    const points: TimePoint[] = []
    let cursor = normalizedStart
    let safety = 0
    while (cursor.getTime() <= normalizedEnd.getTime() && safety < 1500) {
      const key = getBucketKey(cursor, effectiveGranularity)
      const bucket = buckets.get(key)
      points.push({
        key,
        label: getBucketLabel(cursor, effectiveGranularity),
        revenue: bucket?.revenue || 0,
        orders: bucket?.orderGroups.size || 0
      })
      cursor = stepBucket(cursor, effectiveGranularity)
      safety += 1
    }

    if (points.length > 120) return points.slice(points.length - 120)
    return points
  }, [effectiveGranularity, filteredLines, resolvedRange])

  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; label: string; revenue: number; quantity: number; lines: number }>()
    filteredLines.forEach((line) => {
      if (!map.has(line.productId)) {
        map.set(line.productId, { id: line.productId, label: line.productName, revenue: 0, quantity: 0, lines: 0 })
      }
      const row = map.get(line.productId)!
      row.revenue += line.revenue
      row.quantity += line.quantity
      row.lines += 1
    })

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        label: row.label,
        value: row.revenue,
        secondary: `${formatCompactNumber(row.lines)} lignes - ${formatCompactNumber(row.quantity)} unites`
      }))
  }, [filteredLines])

  const topClients = useMemo(() => {
    const map = new Map<string, { id: string; label: string; revenue: number; orders: Set<string> }>()
    filteredLines.forEach((line) => {
      if (!map.has(line.clientId)) {
        map.set(line.clientId, { id: line.clientId, label: line.clientName, revenue: 0, orders: new Set<string>() })
      }
      const row = map.get(line.clientId)!
      row.revenue += line.revenue
      row.orders.add(line.groupId)
    })

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        label: row.label,
        value: row.revenue,
        secondary: `${formatCompactNumber(row.orders.size)} commandes`
      }))
  }, [filteredLines])

  const lowStock = useMemo(() => {
    return products
      .filter((p) => typeof p.stock_quantity === 'number')
      .map((p) => {
        const stock = Number(p.stock_quantity || 0) || 0
        const min = Number(p.min_stock_level || 0) || 0
        const threshold = min > 0 ? min : 0
        return {
          id: String(p.id),
          name: p.name ? String(p.name) : `Produit #${String(p.id).slice(-4)}`,
          stock,
          min,
          threshold
        }
      })
      .filter((row) => row.stock <= row.threshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)
  }, [products])

  const hasAnyFilter =
    statusFilter.length > 0 ||
    productFilter !== 'all' ||
    clientFilter !== 'all' ||
    datePreset !== '30d'

  const resetFilters = () => {
    setDatePreset('30d')
    setGranularity('day')
    setSeriesMode('revenue')
    setStatusFilter([])
    setProductFilter('all')
    setClientFilter('all')
  }

  const toggleStatus = (status: OrderStatus) => {
    setStatusFilter((prev) => {
      if (prev.length === 0) return [status]
      if (prev.includes(status)) {
        const next = prev.filter(s => s !== status)
        return next.length === 0 ? [] : next
      }
      return [...prev, status]
    })
  }

  const exportCsv = () => {
    const header = [
      'created_at',
      'group_id',
      'status',
      'client_id',
      'client_name',
      'product_id',
      'product_name',
      'quantity',
      'unit_price',
      'revenue'
    ]

    const rows = filteredLines
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((line) => [
        line.createdAtISO,
        line.groupId,
        line.status,
        line.clientId,
        line.clientName,
        line.productId,
        line.productName,
        String(line.quantity),
        String(line.unitPrice),
        String(line.revenue)
      ])

    const csv = [header, ...rows]
      .map((cols) => cols.map((col) => `"${String(col).replaceAll('\"', '\"\"')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `statbi_${merchantId}_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-[#00b4d8]">
            <BarChart3 className="h-7 w-7" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-4 border border-rose-200 bg-rose-50">
        <div className="text-sm font-bold text-rose-700">Erreur</div>
        <div className="text-xs text-rose-700 mt-1">{error}</div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[#2C2C2C]">
            <BarChart3 className="h-5 w-5 text-[#714B67]" />
            <h2 className="text-xl font-semibold tracking-tight">Analytique & Performance</h2>
          </div>
          <p className="text-sm text-[#6B6B6B] mt-1">Tableau de bord intelligent style Odoo ERP.</p>
          {lastUpdatedAt && (
            <div className="mt-2 text-[10px] text-gray-400 font-medium uppercase tracking-wider">Dernière mise à jour : {formatLongDateTime(lastUpdatedAt)}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex bg-white border-gray-200 text-gray-600 hover:border-[#714B67] hover:text-[#714B67] rounded-lg"
            onClick={resetFilters}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
          <Button
            size="sm"
            onClick={exportCsv}
            className="bg-[#714B67] text-white hover:bg-[#5a3a52] transition-colors border-0 rounded-lg shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <Card className="p-5 border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 text-gray-800 mb-4 px-1">
          <Filter className="h-4 w-4 text-[#714B67]" />
          <div className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Filtres dynamiques</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12 xl:col-span-5">
            <div className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-widest mb-3 flex items-center gap-2">
              <CalendarRange className="h-3.5 w-3.5" />
              Période d'analyse
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: '7d', label: '7j' },
                { key: '30d', label: '30j' },
                { key: '90d', label: '90j' },
                { key: '365d', label: '1 an' },
                { key: 'all', label: 'Tout' },
                { key: 'custom', label: 'Perso' }
              ].map((opt) => {
                const active = datePreset === (opt.key as DatePreset)
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDatePreset(opt.key as DatePreset)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 ${
                      active
                        ? 'border-[#714B67] bg-[#f5f0f3] text-[#714B67] shadow-sm'
                        : 'border-gray-200 bg-white hover:border-[#714B67]/30 text-[#6B6B6B] hover:text-[#714B67]'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {datePreset !== 'all' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Du</div>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#714B67] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Au</div>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#714B67] transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 xl:col-span-3">
            <div className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-widest mb-3">Affichage</div>
            <div className="space-y-4">
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#714B67] transition-colors h-10"
              >
                <option value="day">Vue Quotidienne</option>
                <option value="week">Vue Hebdomadaire</option>
                <option value="month">Vue Mensuelle</option>
              </select>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSeriesMode('revenue')}
                  className={`flex-1 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all duration-200 ${
                    seriesMode === 'revenue'
                      ? 'border-[#714B67] bg-[#f5f0f3] text-[#714B67]'
                      : 'border-gray-200 bg-white text-[#6B6B6B]'
                  }`}
                >
                  Chiffre d'Affaires
                </button>
                <button
                  type="button"
                  onClick={() => setSeriesMode('orders')}
                  className={`flex-1 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all duration-200 ${
                    seriesMode === 'orders'
                      ? 'border-[#714B67] bg-[#f5f0f3] text-[#714B67]'
                      : 'border-gray-200 bg-white text-[#6B6B6B]'
                  }`}
                >
                  Commandes
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 xl:col-span-4">
            <div className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-widest mb-3">Statuts des commandes</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(STATUS_META) as OrderStatus[]).map((status) => {
                const active = statusFilter.length === 0 ? true : statusFilter.includes(status)
                const meta = STATUS_META[status]

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all duration-200 ${
                      active
                        ? `${meta.chip.replace('bg-opacity-10', '')} shadow-sm border-current`
                        : 'border-gray-100 bg-white text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Produit</div>
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#714B67] transition-colors h-10"
                >
                  <option value="all">Tous</option>
                  {products
                    .slice()
                    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                    .map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.name ? String(p.name) : `ID: ${String(p.id).slice(-4)}`}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Client</div>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#714B67] transition-colors h-10"
                >
                  <option value="all">Tous</option>
                  {clients
                    .slice()
                    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                    .map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {c.name ? String(c.name) : `ID: ${String(c.id).slice(-4)}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-[10px] p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold">
          <span className="text-[#9B9B9B] uppercase tracking-widest mr-1">RÉSUMÉ DU FILTRE :</span>
          <span className="px-2.5 py-1 rounded bg-white border border-gray-200 text-gray-600 shadow-sm">
            {formatCompactNumber(derived.ordersCount)} COMMANDES
          </span>
          <span className="px-2.5 py-1 rounded bg-white border border-gray-200 text-gray-600 shadow-sm">
            {formatCompactNumber(derived.linesCount)} LIGNES
          </span>
          <span className="px-2.5 py-1 rounded bg-white border border-gray-200 text-gray-600 shadow-sm">
            {formatCompactNumber(derived.activeClients)} CLIENTS
          </span>
          <span className="px-2.5 py-1 rounded bg-[#f5f0f3] border border-[#e9d5e2] text-[#714B67] shadow-sm">
            {formatCurrency(derived.revenue)} TOTAL
          </span>
        </div>
      </Card>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <KpiCard
          title="Chiffre d'affaires"
          value={formatCurrency(derived.revenue)}
          subValue="Sur la période filtrée"
          icon={<Wallet className="h-5 w-5" />}
          delta={resolvedRange.start && resolvedRange.end ? { value: derived.deltas.revenue, label: 'vs préc.' } : null}
        />
        <KpiCard
          title="Volume de commandes"
          value={formatCompactNumber(derived.ordersCount)}
          subValue={`${formatCompactNumber(derived.itemsCount)} unités vendues`}
          icon={<ShoppingCart className="h-5 w-5" />}
          delta={resolvedRange.start && resolvedRange.end ? { value: derived.deltas.orders, label: 'vs préc.' } : null}
        />
        <KpiCard
          title="Laboratoires / Clients"
          value={formatCompactNumber(derived.activeClients)}
          subValue={`Panier moyen: ${formatCurrency(derived.aov)}`}
          icon={<Users className="h-5 w-5" />}
          delta={resolvedRange.start && resolvedRange.end ? { value: derived.deltas.clients, label: 'vs préc.' } : null}
        />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7">
          <AreaChart
            title={seriesMode === 'revenue' ? "Courbe du chiffre d'affaires" : 'Courbe des commandes'}
            subtitle={`Période: ${effectiveGranularity === 'day' ? 'Par jour' : effectiveGranularity === 'week' ? 'Par semaine' : 'Par mois'}`}
            points={timeline}
            mode={seriesMode}
            formatValue={formatCurrency}
          />
        </div>
        <div className="xl:col-span-5">
          <DonutChart
            title="États des ventes"
            subtitle="Cliquez sur une légende pour filtrer."
            segments={statusSegments}
            onToggle={toggleStatus}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        <div className="xl:col-span-7">
          <Card className="p-6 border border-gray-200 bg-white shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#6B6B6B] uppercase tracking-widest">Résumé Analytique</div>
                <div className="mt-1 text-2xl text-[#2C2C2C] font-semibold">
                  {formatCompactNumber(products.length)} produits - {formatCompactNumber(clients.length)} laboratoires
                </div>
                <div className="mt-2 text-[11px] text-[#9B9B9B] flex items-center gap-4">
                  <span className="flex items-center gap-1.5">Livraison: <span className="font-bold text-emerald-600">{formatPercent(derived.deliveryRate)}</span></span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="flex items-center gap-1.5">Panier moyen: <span className="font-bold text-[#714B67]">{formatCurrency(derived.aov)}</span></span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[#f5f0f3] border border-[#e9d5e2] text-[#714B67] flex items-center justify-center shadow-sm">
                <BarChart3 className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs flex-1">
              <div className="rounded-xl border border-gray-100 bg-[#F9FAFB] px-4 py-4 flex flex-col justify-center transition-all hover:shadow-sm hover:border-[#714B67]/20 group cursor-default">
                <div className="font-bold text-[#6B6B6B] uppercase tracking-widest mb-1 group-hover:text-[#714B67] transition-colors">CA</div>
                <div className="text-xl text-[#2C2C2C] font-bold truncate">{formatCurrency(derived.revenue)}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#F9FAFB] px-4 py-4 flex flex-col justify-center transition-all hover:shadow-sm hover:border-[#714B67]/20 group cursor-default">
                <div className="font-bold text-[#6B6B6B] uppercase tracking-widest mb-1 group-hover:text-[#714B67] transition-colors">Commandes</div>
                <div className="text-xl text-[#2C2C2C] font-bold">{formatCompactNumber(derived.ordersCount)}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#F9FAFB] px-4 py-4 flex flex-col justify-center transition-all hover:shadow-sm hover:border-[#714B67]/20 group cursor-default">
                <div className="font-bold text-[#6B6B6B] uppercase tracking-widest mb-1 group-hover:text-[#714B67] transition-colors">Lignes</div>
                <div className="text-xl text-[#2C2C2C] font-bold">{formatCompactNumber(derived.linesCount)}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#F9FAFB] px-4 py-4 flex flex-col justify-center transition-all hover:shadow-sm hover:border-[#714B67]/20 group cursor-default">
                <div className="font-bold text-[#6B6B6B] uppercase tracking-widest mb-1 group-hover:text-[#714B67] transition-colors">Unités</div>
                <div className="text-xl text-[#2C2C2C] font-bold">{formatCompactNumber(derived.itemsCount)}</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-5">
          <Card className="p-6 border border-gray-200 bg-white shadow-sm h-full flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-6 border-b border-gray-100 pb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#DC3545]" />
                  <h3 className="text-sm font-bold text-[#6B6B6B] uppercase tracking-widest">Alertes de Stock</h3>
                </div>
                <p className="text-xs text-[#9B9B9B] mt-1.5">Produits sous le seuil critique ou en rupture imminente.</p>
              </div>
              <div className="text-xs font-mono text-[#DC3545] bg-red-50 px-2 py-1 rounded border border-red-100">
                {formatCompactNumber(lowStock.length)} alerte(s)
              </div>
            </div>

            <div className="flex-1">
              {lowStock.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">Aucune alerte d'inventaire critique. Tout est au vert.</div>
              ) : (
                <div className="space-y-3">
                  {lowStock.map((row) => (
                    <div key={row.id} className="rounded-xl border border-red-100 bg-red-50/30 p-4 flex items-center justify-between gap-4 transition-colors hover:bg-red-50/50">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#2C2C2C] truncate">{row.name}</div>
                        <div className="text-xs mt-1.5 flex items-center gap-3">
                          <span className="text-gray-500">Seuil: <span className="font-mono text-gray-700">{row.min}</span></span>
                          <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                          <span className="text-[#DC3545] font-bold">Stock actuel: <span className="font-mono text-lg ml-1">{row.stock}</span></span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProductFilter(row.id)}
                        className="px-4 py-2 min-h-[40px] rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:border-[#714B67] hover:text-[#714B67] transition-all duration-200 shadow-sm whitespace-nowrap"
                      >
                        Voir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
