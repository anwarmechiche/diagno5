'use client'

import InvoicesListPage from './InvoicesListPage'
import { FileText } from 'lucide-react'
import { Product, Client, Order } from '@/utils/supabase/types'

interface InvoicesTabProps {
  merchantId: string
  products: Product[]
  clients: Client[]
  orders: Order[]
  formatCurrency: (value: number) => string
}

export default function InvoicesTab({ merchantId }: InvoicesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <FileText className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Factures</h2>
          <p className="text-sm text-gray-500">
            Générez une facture depuis l&apos;onglet Commandes (confirmation uniquement), puis imprimez-la.
          </p>
        </div>
      </div>

      <InvoicesListPage merchantId={merchantId} hideHeader />
    </div>
  )
}
