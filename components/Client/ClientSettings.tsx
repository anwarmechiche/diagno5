'use client'

import { useState, useEffect } from 'react'
import { 
  User, Bell, LogOut, AlertCircle, CreditCard, 
  MapPin, Eye, EyeOff, MessageSquare,
  Save, Loader, Check, X as XIcon, FileText
} from 'lucide-react'

// Utilisation d'un seul type pour éviter les conflits
export type Client = {
  id: string
  name: string
  client_id?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  postal_code?: string
  wilaya?: string
  payment_mode?: string
  credit_limit?: number
  rc?: string
  fiscal_number?: string  
  ai_number?: string      
  agrement_number?: string 
  notes?: string
  active?: boolean
  show_price?: boolean
  show_quantity?: boolean
  merchant_id?: string
  password?: string
}

interface ClientSettingsProps {
  client: Client
  merchantSettings: any | null
  notificationPermission: 'default' | 'granted' | 'denied'
  showPermissionPrompt: boolean
  onRequestNotificationPermission: () => void
  onLogout: () => void
  formatCurrency: (value: number) => string
  onUpdateProfile: (data: Partial<Client>) => Promise<void>
}

export default function ClientSettings({
  client,
  merchantSettings,
  notificationPermission,
  showPermissionPrompt,
  onRequestNotificationPermission,
  onLogout,
  formatCurrency,
  onUpdateProfile
}: ClientSettingsProps) {
  
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    wilaya: '',
    postal_code: '',
    rc: '',
    fiscal_number: '',
    ai_number: '',
    agrement_number: '',
    payment_mode: '',
    show_price: true,
    show_quantity: true,
    notes: '',
    password: ''
  })

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [emailConfirmations, setEmailConfirmations] = useState(true)

  // Initialisation des données
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        wilaya: client.wilaya || '',
        postal_code: client.postal_code || '',
        rc: client.rc || '',
        fiscal_number: client.fiscal_number || '',
        ai_number: client.ai_number || '',
        agrement_number: client.agrement_number || '',
        payment_mode: client.payment_mode || '',
        show_price: client.show_price ?? true,
        show_quantity: client.show_quantity ?? true,
        notes: client.notes || '',
        password: ''
      })
    }
  }, [client])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('client_send_confirm_email')
    if (stored === 'true' || stored === 'false') setEmailConfirmations(stored === 'true')
  }, [])

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (saveSuccess) setSaveSuccess(false)
    if (saveError) setSaveError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    
    try {
      if (!client.id) throw new Error("ID Medecin manquant");

      // On ne construit l'objet de mise à jour qu'avec les champs modifiés
      const updates: any = { id: client.id }; // L'ID est indispensable pour le .eq('id', ...)
      let hasChanges = false;

      const fieldsToCompare = [
        'name', 'email', 'phone', 'address', 'city', 'wilaya', 
        'postal_code', 'rc', 'fiscal_number', 'ai_number', 
        'agrement_number', 'payment_mode', 'show_price', 
        'show_quantity', 'notes'
      ];

      fieldsToCompare.forEach(field => {
        const newVal = formData[field as keyof Client];
        const oldVal = client[field as keyof Client];
        
        if (newVal !== oldVal) {
          updates[field] = newVal;
          hasChanges = true;
        }
      });

      // Mot de passe séparé
      if (formData.password && formData.password.trim() !== '') {
        updates.password = formData.password;
        hasChanges = true;
      }

      if (!hasChanges) {
        setSaveError("Aucune modification à enregistrer");
        setSaving(false);
        return;
      }

      // Appel de la fonction parente qui exécute le supabase.update()
      await onUpdateProfile(updates);
      
      setSaveSuccess(true);
      setFormData(prev => ({ ...prev, password: '' })); // Reset champ password
      
      // Auto-hide success message
      setTimeout(() => setSaveSuccess(false), 5000);

    } catch (error: any) {
      console.error('Erreur ClientSettings:', error);
      setSaveError(error.message || "Impossible de mettre à jour le profil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 pb-20">
      
      {/* Notifications flottantes */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
        {saveSuccess && (
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
            <Check className="w-6 h-6" />
            <span className="font-medium">Profil mis à jour avec succès !</span>
          </div>
        )}
        {saveError && (
          <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
            <AlertCircle className="w-6 h-6" />
            <span className="font-medium">{saveError}</span>
          </div>
        )}
      </div>

      {/* Header & Save Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres du compte</h1>
          <p className="text-gray-500 text-sm">Gérez vos informations et préférences de facturation</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all shadow-md disabled:opacity-50"
        >
          {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? "Enregistrement..." : "Sauvegarder"}
        </button>
      </div>

      {/* SECTION 1: PERSO */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 font-bold text-emerald-600">
          <User className="w-5 h-5" />
          Identité
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nom complet</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email professionnel</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 dark:text-white">Emails</div>
                <div className="text-xs text-gray-500">Recevoir la confirmation de commande et les documents (si le fournisseur active l’envoi).</div>
              </div>
              <input
                type="checkbox"
                checked={emailConfirmations}
                onChange={(e) => {
                  const next = e.target.checked
                  setEmailConfirmations(next)
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("client_send_confirm_email", String(next))
                  }
                }}
                className="h-5 w-5 accent-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Numéro de téléphone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Sécurité (Mot de passe)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Laisser vide pour inchangé"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: FISCALITÉ */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 font-bold text-emerald-600">
          <FileText className="w-5 h-5" />
          Informations Fiscales
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Registre Commerce (RC)', key: 'rc' },
            { label: 'Numéro Fiscal (NIF)', key: 'fiscal_number' },
            { label: 'Article Imposition (AI)', key: 'ai_number' },
            { label: 'Numéro Agrément', key: 'agrement_number' },
          ].map((item) => (
            <div key={item.key} className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">{item.label}</label>
              <input
                type="text"
                value={(formData as any)[item.key]}
                onChange={(e) => handleChange(item.key, e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: LOCALISATION */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 font-bold text-emerald-600">
          <MapPin className="w-5 h-5" />
          Adresse de livraison
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-3">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Adresse complète</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Ville</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Wilaya</label>
            <input
              type="text"
              value={formData.wilaya}
              onChange={(e) => handleChange('wilaya', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Code Postal</label>
            <input
              type="text"
              value={formData.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: NOTIFICATIONS */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 font-bold text-emerald-600">
          <Bell className="w-5 h-5" />
          Notifications
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 dark:text-white">Notifications Navigateur</div>
              <div className="text-xs text-gray-500 text-pretty">Recevoir des alertes en temps réel sur cet appareil lors du changement de statut de vos commandes.</div>
            </div>
            <button
              onClick={onRequestNotificationPermission}
              disabled={notificationPermission === 'granted'}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                notificationPermission === 'granted'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
              }`}
            >
              {notificationPermission === 'granted' ? (
                <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Activé</span>
              ) : 'Activer'}
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button 
          onClick={onLogout}
          className="order-2 sm:order-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-2xl font-bold transition-all"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="order-1 sm:order-2 flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none transition-all disabled:opacity-50"
        >
          {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Confirmer les changements
        </button>
      </div>
    </div>
  )
}


