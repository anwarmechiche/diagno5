export interface Merchant {
  id: string
  merchant_id: string
  name: string
  password: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  merchant_id: string
  client_id: string
  name: string
  password: string
  email?: string
  phone?: string
  address?: string
  city?: string
  zip?: string
  wilaya?: string
  payment_mode?: string
  credit_limit?: number
  fiscal_number?: string
  notes?: string
  active: boolean
  show_price: boolean
  show_quantity: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  merchant_id: string
  name: string
  price: number
  description?: string
  image_data?: string
  image?: string
  active: boolean
  created_at: string
  updated_at: string
  provenance?: string
  reference_code?: string
  lot_number?: string
  supplier?: string
  volume_ml?: number
  expiration_date?: string
  ref?: string
  stock_quantity?: number
  min_stock_level?: number
  category?: string
}

export interface Order {
  id: string
  merchant_id: string
  client_id: string
  product_id: string
  quantity: number
  status: 'pending' | 'validated' | 'delivered' | 'cancelled'
  order_group_id?: string
  created_at: string
  updated_at: string
}

export interface BrandSettings {
  name: string
  fiscal: string
  logo: string
}

export interface CartItem {
  productId: string
  quantity: number
  product?: Product
}
export interface MerchantSettings {
  id: string
  merchant_id: string
  company_name: string
  company_email: string
  company_phone: string
  company_address: string
  company_city: string
  company_country: string
  company_website: string
  tax_id: string
  trade_registry: string
  bank_name: string
  bank_account: string
  currency: string
  payment_terms: number
  invoice_prefix: string
  invoice_start_number: number
  logo_url: string
  theme_color: string
  language: string
  timezone: string
  notification_email: boolean
  notification_sms: boolean
  notification_whatsapp: boolean
  auto_invoice: boolean
  auto_reminder: boolean
  reminder_days: number
  signature: string
  notes: string
  created_at: string
  updated_at: string
}
