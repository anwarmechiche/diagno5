'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { db } from '@/utils/supabase/client'
import { MerchantSettings } from '@/utils/supabase/types'
import { AlertTriangle, Mail, MessageCircle, Smartphone, BellRing } from 'lucide-react'

interface MerchantSettingsTabProps {
  merchantId: string
  user: any
}

export default function MerchantSettingsTab({ merchantId, user }: MerchantSettingsTabProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MerchantSettings>({
    id: '',
    merchant_id: merchantId,
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: '',
    company_city: '',
    company_country: 'Algérie',
    company_website: '',
    tax_id: '',
    trade_registry: '',
    bank_name: '',
    bank_account: '',
    currency: 'DZD',
    payment_terms: 30,
    invoice_prefix: 'FAC',
    invoice_start_number: 1000,
    logo_url: '',
    theme_color: '#3B82F6',
    language: 'fr',
    timezone: 'Africa/Algiers',
    notification_email: true,
    notification_sms: false,
    notification_whatsapp: true,
    auto_invoice: true,
    auto_reminder: false,
    reminder_days: 7,
    signature: '',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  const [docEmailSending, setDocEmailSending] = useState<null | 'invoice' | 'delivery'>(null)
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' ? (Notification as any).permission : 'default'
  )
  const ITEMS_PER_PAGE = 8

  const requestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission)
        if (permission === 'granted') {
          alert('Notifications activées avec succès !')
        }
      })
    }
  }

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')

  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [oauthStatus, setOauthStatus] = useState<null | {
    connected: boolean
    provider?: string
    email?: string
    expires_at?: string | null
  }>(null)
  const [oauthChecking, setOauthChecking] = useState(false)
  const [oauthError, setOauthError] = useState<string>('')
  
  const [manualGmail, setManualGmail] = useState({
    email: '',
    password: ''
  })
  const [manualLoading, setManualLoading] = useState(false)

  const getApiBaseUrl = () => {
    if (typeof window === 'undefined') return ''
    const stored = String(window.localStorage.getItem('app_api_base_url') || '').trim()
    const env = String((process as any)?.env?.NEXT_PUBLIC_APP_URL || '').trim()
    const base = stored || env
    return base ? base.replace(/\/$/, '') : ''
  }

  const checkOauthStatus = async () => {
    if (!merchantId) return
    setOauthError('')
    setOauthChecking(true)
    try {
      const base = getApiBaseUrl()
      const url = base ? `${base}/api/oauth/status?merchantId=${encodeURIComponent(String(merchantId))}` : `/api/oauth/status?merchantId=${encodeURIComponent(String(merchantId))}`
      const res = await fetch(url)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Impossible de vérifier le statut email')
      setOauthStatus(json)
    } catch (e: any) {
      setOauthStatus(null)
      setOauthError(String(e?.message || 'Erreur vérification email'))
    } finally {
      setOauthChecking(false)
    }
  }

  const saveApiBaseUrl = () => {
    if (typeof window === 'undefined') return
    const normalized = String(apiBaseUrl || '').trim().replace(/\/$/, '')
    window.localStorage.setItem('app_api_base_url', normalized)
    setApiBaseUrl(normalized)
    void checkOauthStatus()
  }

  const startOauth = (provider: 'google' | 'microsoft') => {
    const base = getApiBaseUrl()
    const path = provider === 'google' ? '/api/oauth/google/start' : '/api/oauth/microsoft/start'
    const url = base ? `${base}${path}?merchantId=${encodeURIComponent(String(merchantId))}` : `${path}?merchantId=${encodeURIComponent(String(merchantId))}`
    window.location.href = url
  }

  const disconnectOauth = async () => {
    if (!confirm('Déconnecter le compte email expéditeur ?')) return
    setOauthError('')
    setOauthChecking(true)
    try {
      const base = getApiBaseUrl()
      const url = base ? `${base}/api/oauth/disconnect` : '/api/oauth/disconnect'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Impossible de déconnecter')
      await checkOauthStatus()
    } catch (e: any) {
      setOauthError(String(e?.message || 'Erreur déconnexion'))
    } finally {
      setOauthChecking(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = String(window.localStorage.getItem('app_api_base_url') || '').trim()
    setApiBaseUrl(stored)
  }, [])

  // Sections configurables
  const SECTIONS = [
    {
      id: 'company',
      title: 'Informations de la Société',
      icon: '🏢',
      description: 'Coordonnées officielles de votre entreprise'
    },
    {
      id: 'financial',
      title: 'Informations Financières',
      icon: '💰',
      description: 'Détails bancaires et fiscaux'
    },
    {
      id: 'invoicing',
      title: 'Facturation',
      icon: '🧾',
      description: 'Paramètres de facturation'
    },
    {
      id: 'appearance',
      title: 'Apparence',
      icon: '🎨',
      description: 'Personnalisation visuelle'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: '🔔',
      description: 'Préférences de communication'
    },
    {
      id: 'advanced',
      title: 'Paramètres Avancés',
      icon: '⚙️',
      description: 'Options supplémentaires'
    }
  ]

  const [activeSection, setActiveSection] = useState('company')

  useEffect(() => {
    loadSettings()
    void checkOauthStatus()
  }, [merchantId])

  const loadSettings = async () => {
  setLoading(true)
  try {
    // SIMULATION : Retourne des données de test
    const testData = {
      id: 'test',
      merchant_id: merchantId,
      company_name: 'Entreprise Test',
      company_email: 'test@entreprise.dz',
      company_phone: '0550123456',
      company_address: 'Alger',
      company_city: 'Alger',
      company_country: 'Algérie',
      company_website: '',
      tax_id: '',
      trade_registry: '',
      bank_name: '',
      bank_account: '',
      currency: 'DZD',
      payment_terms: 30,
      invoice_prefix: 'FAC',
      invoice_start_number: 1000,
      logo_url: '',
      theme_color: '#3B82F6',
      language: 'fr',
      timezone: 'Africa/Algiers',
      notification_email: true,
      notification_sms: false,
      notification_whatsapp: true,
      auto_invoice: true,
      auto_reminder: false,
      reminder_days: 7,
      signature: '',
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    setSettings(testData)
  } catch (error) {
    console.error('Error loading settings:', error)
  } finally {
    setLoading(false)
  }
}


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'number' ? Number(value) : value
    }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('La taille du fichier ne doit pas dépasser 5MB')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

const handleSaveSettings = async () => {
  setSaving(true)
  try {
    // Upload logo si sélectionné (simulation)
    let logoUrl = settings.logo_url
    if (logoFile) {
      console.log('Simulation upload logo:', logoFile.name)
      // Simulez un upload
      await new Promise(resolve => setTimeout(resolve, 500))
      logoUrl = 'https://example.com/logo.png' // URL simulée
    }

    const updatedSettings = {
      ...settings,
      logo_url: logoUrl,
      updated_at: new Date().toISOString()
    }

    console.log('Settings à sauvegarder:', updatedSettings)
    
    // Simulation de sauvegarde
    await new Promise(resolve => setTimeout(resolve, 500))
    
    alert('Paramètres enregistrés avec succès! (mode test)')
    
  } catch (error) {
    console.error('Error saving settings:', error)
    alert('Erreur lors de l\'enregistrement des paramètres')
  } finally {
    setSaving(false)
  }
}

  const handleResetSettings = () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) {
      setSettings({
        ...settings,
        company_name: '',
        company_email: '',
        company_phone: '',
        company_address: '',
        company_city: '',
        tax_id: '',
        trade_registry: '',
        bank_name: '',
        bank_account: '',
        payment_terms: 30,
        invoice_prefix: 'FAC',
        invoice_start_number: 1000,
        logo_url: '',
        theme_color: '#3B82F6',
        notification_email: true,
        notification_sms: false,
        notification_whatsapp: true,
        auto_invoice: true,
        auto_reminder: false,
        reminder_days: 7,
        signature: '',
        notes: ''
      })
      setLogoPreview('')
      setLogoFile(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  const renderCompanySection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nom de l'entreprise *</label>
          <input
            type="text"
            name="company_name"
            value={settings.company_name}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="Nom officiel de votre société"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Email professionnel *</label>
          <input
            type="email"
            name="company_email"
            value={settings.company_email}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="contact@entreprise.dz"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Téléphone *</label>
          <input
            type="tel"
            name="company_phone"
            value={settings.company_phone}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="0550123456"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Ville *</label>
          <input
            type="text"
            name="company_city"
            value={settings.company_city}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="Alger"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse complète</label>
          <input
            type="text"
            name="company_address"
            value={settings.company_address}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="Rue, Quartier, Commune"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Site web</label>
          <input
            type="url"
            name="company_website"
            value={settings.company_website}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="https://www.entreprise.dz"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Pays</label>
          <select
            name="company_country"
            value={settings.company_country}
            onChange={handleInputChange}
            className="form-select w-full"
          >
            <option value="Algérie">Algérie</option>
            <option value="France">France</option>
            <option value="Tunisie">Tunisie</option>
            <option value="Maroc">Maroc</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderFinancialSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">NIF (Numéro d'Identification Fiscale)</label>
          <input
            type="text"
            name="tax_id"
            value={settings.tax_id}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="123456789012345"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Registre de Commerce</label>
          <input
            type="text"
            name="trade_registry"
            value={settings.trade_registry}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="RC 123456789"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nom de la banque</label>
          <input
            type="text"
            name="bank_name"
            value={settings.bank_name}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="Banque Extérieure d'Algérie"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro de compte</label>
          <input
            type="text"
            name="bank_account"
            value={settings.bank_account}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="003-123456789-12"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Devise par défaut</label>
          <select
            name="currency"
            value={settings.currency}
            onChange={handleInputChange}
            className="form-select w-full"
          >
            <option value="DZD">Dinar Algérien (DZD)</option>
            <option value="EUR">Euro (€)</option>
            <option value="USD">Dollar US ($)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Délai de paiement (jours)</label>
          <input
            type="number"
            name="payment_terms"
            value={settings.payment_terms}
            onChange={handleInputChange}
            className="form-input w-full"
            min="0"
            max="90"
          />
        </div>
      </div>
    </div>
  )

  const renderInvoicingSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Préfixe des factures</label>
          <input
            type="text"
            name="invoice_prefix"
            value={settings.invoice_prefix}
            onChange={handleInputChange}
            className="form-input w-full"
            placeholder="FAC"
            maxLength={10}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro de départ</label>
          <input
            type="number"
            name="invoice_start_number"
            value={settings.invoice_start_number}
            onChange={handleInputChange}
            className="form-input w-full"
            min="1"
          />
        </div>
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="auto_invoice"
              name="auto_invoice"
              checked={settings.auto_invoice}
              onChange={handleInputChange}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <label htmlFor="auto_invoice" className="block text-sm font-semibold text-gray-700">
                Génération automatique des factures
              </label>
              <p className="text-sm text-gray-500 mt-1">Générer automatiquement une facture après chaque commande</p>
            </div>
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="auto_reminder"
              name="auto_reminder"
              checked={settings.auto_reminder}
              onChange={handleInputChange}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <label htmlFor="auto_reminder" className="block text-sm font-semibold text-gray-700">
                Rappels automatiques
              </label>
              <p className="text-sm text-gray-500 mt-1">Envoyer des rappels automatiques pour les paiements en retard</p>
              {settings.auto_reminder && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-gray-600">Envoyer après</span>
                  <input
                    type="number"
                    name="reminder_days"
                    value={settings.reminder_days}
                    onChange={handleInputChange}
                    className="form-input w-24"
                    min="1"
                    max="30"
                  />
                  <span className="text-sm text-gray-600">jours de retard</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Emails & documents</h3>
        <p className="text-sm text-gray-500">
          Connectez votre Gmail ou Outlook pour envoyer automatiquement les factures / bons de livraison.
        </p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg border">
            <div className="font-semibold text-gray-800">URL serveur/API (optionnel)</div>
            <div className="text-sm text-gray-500 mt-1">
              Utile si l’app est installée (mobile/desktop) ou si /api n’est pas accessible en local.
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://votre-domaine.com"
                className="form-input flex-1"
              />
              <Button type="button" onClick={saveApiBaseUrl} icon="💾">
                Enregistrer
              </Button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Laissez vide en développement si vous utilisez `npm run dev`.
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-800">Compte expéditeur</div>
                <div className="text-sm text-gray-500 mt-1">
                  {oauthStatus?.connected
                    ? `Connecté: ${oauthStatus.email || ''} (${oauthStatus.provider || ''})`
                    : 'Non connecté'}
                </div>
              </div>
              <div
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  oauthStatus?.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {oauthChecking ? 'Vérification…' : oauthStatus?.connected ? 'OK' : 'OFF'}
              </div>
            </div>

            {oauthError && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {oauthError}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => startOauth('google')}>
                Connecter Gmail
              </Button>
              <Button type="button" onClick={() => startOauth('microsoft')}>
                Connecter Outlook
              </Button>
              <Button type="button" variant="success" onClick={checkOauthStatus}>
                Rafraîchir
              </Button>
              {oauthStatus?.connected && (
                <Button type="button" variant="danger" onClick={disconnectOauth}>
                  Déconnecter
                </Button>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Gmail/Outlook utilisent OAuth. Aucun mot de passe n’est demandé dans l’interface.
            </div>

            <div className="mt-6 pt-6 border-t">
              <div className="font-semibold text-[#714B67] flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5" />
                Configuration Manuelle Gmail (App Password)
              </div>
              <div className="text-sm text-gray-600 mb-4 bg-[#f8f9fa] p-5 rounded-xl border border-[#e9ecef] shadow-sm">
                <p className="font-bold text-[#714B67] mb-2 flex items-center gap-2">
                  <span className="bg-[#714B67] text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">!</span>
                  Comment obtenir votre mot de passe Gmail ?
                </p>
                <div className="space-y-2 text-xs leading-relaxed">
                  <p>Pour des raisons de sécurité, Google demande un <strong>"Mot de passe d'application"</strong> (16 caractères) à la place de votre mot de passe habituel.</p>
                  <ol className="list-decimal ml-4 space-y-1 text-[#4B4B4B]">
                    <li>Allez sur : <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">myaccount.google.com/apppasswords</a></li>
                    <li>Connectez-vous à votre compte Google.</li>
                    <li>Donnez un nom (ex: "Diagnosphère") et cliquez sur <b>Créer</b>.</li>
                    <li>Copiez le code jaune de 16 lettres et collez-le ci-dessous.</li>
                  </ol>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Gmail</label>
                  <input
                    type="email"
                    value={manualGmail.email}
                    onChange={(e) => setManualGmail(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="votre.email@gmail.com"
                    className="form-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mot de passe d'application (16 caractères)</label>
                  <input
                    type="password"
                    value={manualGmail.password}
                    onChange={(e) => setManualGmail(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="form-input w-full text-sm font-mono"
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={async () => {
                    if (!manualGmail.email || !manualGmail.password) {
                      alert('Veuillez remplir l\'email et le mot de passe d\'application.');
                      return;
                    }
                    setManualLoading(true);
                    try {
                      const res = await fetch('/api/oauth/gmail-manual', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          merchantId,
                          email: manualGmail.email,
                          password: manualGmail.password
                        })
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || 'Erreur lors de la configuration');
                      alert('Gmail configuré avec succès !');
                      checkOauthStatus();
                    } catch (e: any) {
                      alert(e.message);
                    } finally {
                      setManualLoading(false);
                    }
                  }}
                  disabled={manualLoading}
                  className="w-full sm:w-auto"
                >
                  {manualLoading ? 'Configuration...' : 'Enregistrer la configuration Gmail'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Logo de l'entreprise</label>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-4">
                  <div className="text-3xl mb-2">🏢</div>
                  <p className="text-xs text-gray-500">Aucun logo</p>
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                id="logo_upload"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <label htmlFor="logo_upload" className="cursor-pointer">
                <Button variant="outline" icon="📁" className="mb-3">
                  {logoPreview ? 'Changer le logo' : 'Télécharger un logo'}
                </Button>
              </label>
              <p className="text-sm text-gray-500">
                Taille recommandée: 300x300px. Formats: PNG, JPG, SVG. Max: 5MB
              </p>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoPreview(''); setLogoFile(null); }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer le logo
                </button>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Couleur du thème</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="theme_color"
              value={settings.theme_color}
              onChange={handleInputChange}
              className="w-12 h-12 cursor-pointer rounded border border-gray-300"
            />
            <input
              type="text"
              value={settings.theme_color}
              onChange={handleInputChange}
              className="form-input flex-1 font-mono"
              maxLength={7}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, theme_color: '#3B82F6' }))}
              className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white"
              title="Bleu"
            />
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, theme_color: '#10B981' }))}
              className="w-8 h-8 rounded-full bg-green-500 border-2 border-white"
              title="Vert"
            />
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, theme_color: '#8B5CF6' }))}
              className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white"
              title="Violet"
            />
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, theme_color: '#F59E0B' }))}
              className="w-8 h-8 rounded-full bg-yellow-500 border-2 border-white"
              title="Jaune"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Langue</label>
          <select
            name="language"
            value={settings.language}
            onChange={handleInputChange}
            className="form-select w-full"
          >
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Fuseau horaire</label>
          <select
            name="timezone"
            value={settings.timezone}
            onChange={handleInputChange}
            className="form-select w-full"
          >
            <option value="Africa/Algiers">Algérie (UTC+1)</option>
            <option value="Europe/Paris">France (UTC+1/+2)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Canaux de notification</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Notifications navigateur</div>
                <div className="text-sm text-gray-500">Alertes sonores et visuelles en temps réel sur cet appareil</div>
              </div>
            </div>
            <Button
              variant={notificationPermission === 'granted' ? 'outline' : 'primary'}
              onClick={requestNotificationPermission}
              disabled={notificationPermission === 'granted'}
              className="px-4 py-2 text-sm"
            >
              {notificationPermission === 'granted' ? 'Déjà activé' : 'Activer maintenant'}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Notifications par email</div>
                <div className="text-sm text-gray-500">Commandes, factures, rappels</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="notification_email"
                checked={settings.notification_email}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Notifications WhatsApp</div>
                <div className="text-sm text-gray-500">Alertes urgentes et confirmations</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="notification_whatsapp"
                checked={settings.notification_whatsapp}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Notifications SMS</div>
                <div className="text-sm text-gray-500">Rappels de paiement</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="notification_sms"
                checked={settings.notification_sms}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAdvancedSection = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Signature pour les factures</label>
        <textarea
          name="signature"
          value={settings.signature}
          onChange={handleInputChange}
          className="form-textarea w-full h-32"
          placeholder="Votre signature ou message à inclure dans les factures..."
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Notes internes</label>
        <textarea
          name="notes"
          value={settings.notes}
          onChange={handleInputChange}
          className="form-textarea w-full h-40"
          placeholder="Notes, instructions ou informations supplémentaires..."
        />
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600" />
          <div>
            <h4 className="font-semibold text-yellow-800 mb-1">Zone d'administration</h4>
            <p className="text-sm text-yellow-700 mb-3">
              Ces paramètres affectent le comportement de l'application. Modifiez-les avec précaution.
            </p>
            <Button
              variant="danger"
              onClick={handleResetSettings}
              className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-300"
            >
              Réinitialiser les paramètres
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-dark font-poppins mb-2">Paramètres du Fournisseur</h2>
            <p className="text-gray-600">Configurez votre profil et les préférences de votre entreprise</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleResetSettings}
              icon="🔄"
            >
              Réinitialiser
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              icon={saving ? '⏳' : '💾'}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation latérale */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-2">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-4 rounded-lg transition-all duration-200 flex items-start gap-3 ${
                    activeSection === section.id
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="text-xl">{section.icon}</div>
                  <div>
                    <div className={`font-semibold ${activeSection === section.id ? 'text-white' : 'text-gray-800'}`}>
                      {section.title}
                    </div>
                    <div className={`text-sm mt-1 ${activeSection === section.id ? 'text-white/80' : 'text-gray-500'}`}>
                      {section.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Contenu principal */}
          <div className="lg:col-span-3">
            <Card className="p-8">
              {/* Section header */}
              {SECTIONS.map(section => section.id === activeSection && (
                <div key={section.id} className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-3xl">{section.icon}</div>
                    <div>
                      <h3 className="text-xl font-bold text-dark font-poppins">{section.title}</h3>
                      <p className="text-gray-600">{section.description}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Section content */}
              <div className="space-y-8">
                {activeSection === 'company' && renderCompanySection()}
                {activeSection === 'financial' && renderFinancialSection()}
                {activeSection === 'invoicing' && renderInvoicingSection()}
                {activeSection === 'appearance' && renderAppearanceSection()}
                {activeSection === 'notifications' && renderNotificationsSection()}
                {activeSection === 'advanced' && renderAdvancedSection()}
              </div>

              {/* Save button at bottom */}
              <div className="mt-12 pt-8 border-t flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="min-w-[200px]"
                  icon={saving ? '⏳' : '💾'}
                >
                  {saving ? 'Enregistrement en cours...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  )
}
