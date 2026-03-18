'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'

interface InvoiceFormProps {
  onSubmit: (data: any) => void
  onClose: () => void
  invoice?: any
  deliveryNote?: any
  merchantId: string
  formatCurrency: (value: number) => string
}

export default function InvoiceForm({
  onSubmit,
  onClose,
  invoice,
  deliveryNote,
  merchantId,
  formatCurrency
}: InvoiceFormProps) {
  const [formData, setFormData] = useState({
    client_id: invoice?.client_id || deliveryNote?.client_id || '',
    date: invoice?.date || new Date().toISOString().split('T')[0],
    due_date: invoice?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: invoice?.items || deliveryNote?.items || [],
    total_ht: invoice?.total_ht || deliveryNote?.total_ht || 0,
    tva_rate: invoice?.tva_rate ?? deliveryNote?.tva_rate ?? 0,
    total_ttc: invoice?.total_ttc || deliveryNote?.total_ttc || 0,
    status: invoice?.status || 'draft',
    payment_method: invoice?.payment_method || '',
    notes: invoice?.notes || '',
    delivery_note_id: deliveryNote?.id || invoice?.delivery_note_id
  })

  const recalcTotals = (items: any[], tvaRate: number) => {
    const totalHT = items.reduce((sum, item) => {
      const price = Number(item.price) || 0
      const quantity = Number(item.quantity) || 0
      return sum + price * quantity
    }, 0)

  const computedTTC = totalHT * (1 + (Number(tvaRate) || 0) / 100)
  return { totalHT, totalTTC: computedTTC }
  }

  const updateItems = (items: any[]) => {
    const { totalHT, totalTTC } = recalcTotals(items, Number(formData.tva_rate))
    setFormData(prev => ({ ...prev, items, total_ht: totalHT, total_ttc: totalTTC }))
  }

  const handleItemChange = (index: number, field: 'name' | 'price' | 'quantity', value: string) => {
    const updatedItems = formData.items.map((item: any, itemIndex: number) => {
      if (itemIndex !== index) return item
      return { ...item, [field]: field === 'name' ? value : Number(value) }
    })
    updateItems(updatedItems)
  }

  const handleAddItem = () => {
    updateItems([
      ...formData.items,
      { name: '', price: 0, quantity: 1 }
    ])
  }

  const handleRemoveItem = (index: number) => {
    updateItems(formData.items.filter((_: any, itemIndex: number) => itemIndex !== index))
  }

  const handleTvaChange = (value: string) => {
    const rate = Number(value) || 0
    const { totalHT, totalTTC } = recalcTotals(formData.items, rate)
    setFormData(prev => ({
      ...prev,
      tva_rate: rate,
      total_ht: totalHT,
      total_ttc: totalTTC
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  useEffect(() => {
    updateItems(formData.items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Date de facture
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Date d'échéance
          </label>
          <input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({...formData, due_date: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none"
            required
          />
        </div>
      </div>

      {/* Statut */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Statut
        </label>
        <select
          value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value})}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none"
        >
          <option value="draft">Brouillon</option>
          <option value="pending">En attente</option>
          <option value="paid">Payée</option>
        </select>
      </div>

      {/* Mode de paiement */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Mode de paiement
          </label>
          <select
            value={formData.payment_method}
            onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none"
          >
            <option value="">Selectionner...</option>
            <option value="cash">Especes</option>
            <option value="card">Carte bancaire</option>
            <option value="check">Cheque</option>
            <option value="bank_transfer">Virement bancaire</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            TVA (%)
          </label>
          <input
            type="number"
            min="0"
            value={formData.tva_rate}
            onChange={(e) => handleTvaChange(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none"
          />
        </div>
      </div>

      {/* Articles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="block text-sm font-bold text-gray-700">
              Articles
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Ajoutez des lignes et ajustez prix / quantités.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="text-blue-600 text-xs font-semibold uppercase tracking-wide"
          >
            Ajouter un article
          </button>
        </div>
        <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-xs font-bold text-gray-500">Article</th>
                <th className="text-right p-3 text-xs font-bold text-gray-500">Prix HT</th>
                <th className="text-right p-3 text-xs font-bold text-gray-500">Qté</th>
                <th className="text-right p-3 text-xs font-bold text-gray-500">Total HT</th>
                <th className="text-center p-3 text-xs font-bold text-gray-500">Supprimer</th>
              </tr>
            </thead>
            <tbody>
              {formData.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-xs text-gray-500">
                    Aucun article défini pour l'instant.
                  </td>
                </tr>
              )}
              {formData.items.map((item: any, index: number) => (
                <tr key={index} className="border-t border-gray-100">
                  <td className="p-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="Nom de l'article"
                      className="w-full text-sm border border-gray-200 px-3 py-2 rounded-lg"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price ?? 0}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      className="w-full text-sm border border-gray-200 px-3 py-2 rounded-lg text-right"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      value={item.quantity ?? 0}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="w-full text-sm border border-gray-200 px-3 py-2 rounded-lg text-right"
                    />
                  </td>
                  <td className="p-3 text-right font-bold">
                    {formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 text-xs font-semibold"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totaux */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2">
          <div className="flex justify-between">
            <span className="font-medium text-gray-600">Total HT:</span>
            <span className="font-bold">{formatCurrency(formData.total_ht)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-600">TVA ({formData.tva_rate}%):</span>
            <span className="font-bold">{formatCurrency(formData.total_ht * formData.tva_rate / 100)}</span>
          </div>
          <div className="flex justify-between text-lg border-t-2 border-gray-200 pt-2">
            <span className="font-black text-gray-700">Total TTC:</span>
            <span className="font-black text-blue-600">{formatCurrency(formData.total_ttc)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none resize-none"
          placeholder="Notes supplémentaires..."
        />
      </div>

      {/* Boutons */}
      <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-100">
        <Button variant="outline" onClick={onClose} type="button">
          Annuler
        </Button>
        <Button type="submit">
          {invoice ? 'Mettre à jour' : 'Créer la facture'}
        </Button>
      </div>
    </form>
  )
}
