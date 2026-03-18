import { supabase } from '@/lib/supabase'

// --- INTERFACES ---

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
  // NOUVEAUX CHAMPS STOCK
  stock_quantity: number 
  min_stock_level: number
}

export interface Order {
  id: string
  merchant_id: string
  client_id: string
  product_id: string
  quantity: number
  status: 'pending' | 'delivered'
  client_email?: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  client_id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

// --- CLASSE CLIENT ---

export class SupabaseClient {
  
  // 1. AUTHENTIFICATION
  async loginMerchant(merchantId: string, password: string): Promise<Merchant | null> {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('password', password)
      .single()

    if (error || !data) return null
    return data
  }

  async loginClient(clientId: string, password: string, merchantId: string): Promise<Client | null> {
    try {
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('merchant_id', merchantId)
        .single()

      if (merchantError || !merchantData) return null

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('client_id', clientId)
        .eq('password', password)
        .eq('merchant_id', merchantData.id)
        .single()

      if (error || !data) return null
      return data
    } catch (error) {
      console.error('Login client error:', error)
      return null
    }
  }

  // 2. RÉCUPÉRATION DE DONNÉES (LISTES)
  async getProducts(merchantId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })

    if (error) return []
    
    const products = data?.map(product => ({
      ...product,
      image_data: product.image || undefined
    })) || []
    
    return products
  }

  async getClients(merchantId: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })

    if (error) return []
    return data || []
  }

  async getOrders(merchantId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })

    if (error) return []
    return data || []
  }

  // 3. RÉCUPÉRATION PAR ID
  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
      
    if (error) return null
    
    if (data) {
      return {
        ...data,
        image_data: data.image || undefined
      }
    }
    return null
  }

  async getClientById(id: string | number): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return data as Client
  }

  // 4. GESTION DES NOTIFICATIONS
  async getNotifications(clientId: string): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Get notifications error:', error)
      return []
    }
  }

  // 5. CRUD OPÉRATIONS (INSERT / UPDATE / DELETE)
  async createProduct(product: any): Promise<Product | null> {
    const productData: any = {
      name: product.name,
      price: product.price,
      description: product.description || null,
      supplier: product.supplier || null,
      active: product.active ?? true,
      volume_ml: product.volume_ml || null,
      expiration_date: product.expiration_date || null,
      provenance: product.provenance || null,
      reference_code: product.reference_code || null,
      lot_number: product.lot_number || null,
      image: product.image || null,
      merchant_id: parseInt(product.merchant_id),
      // AJOUT STOCK
      stock_quantity: parseInt(product.stock_quantity) || 0,
      min_stock_level: parseInt(product.min_stock_level) || 0
    }

    Object.keys(productData).forEach(key => 
      productData[key] === undefined && delete productData[key]
    )

    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single()

    if (error) {
      console.error("Erreur Supabase createProduct:", error.message)
      throw error
    }
    
    if (data) {
      return {
        ...data,
        image_data: data.image || undefined
      }
    }
    return null
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    const updateData: any = { 
      ...updates, 
      updated_at: new Date().toISOString() 
    }
    
    if (updates.image_data) {
      updateData.image = updates.image_data
      delete updateData.image_data
    }

    // Assurer le formatage des nombres si présents
    if (updates.stock_quantity !== undefined) updateData.stock_quantity = parseInt(updates.stock_quantity as any)
    if (updates.min_stock_level !== undefined) updateData.min_stock_level = parseInt(updates.min_stock_level as any)

    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    )

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
      
    if (error) {
      console.error("Erreur Supabase updateProduct:", error.message)
      return null
    }
    
    if (data) {
      return {
        ...data,
        image_data: data.image || undefined
      }
    }
    return null
  }

  async deleteProduct(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
    return !error
  }

  // ... Reste des méthodes (Clients, Orders, Merchants) inchangées
  async createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .insert([{ ...client, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      .select().single()
    return error ? null : data
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    return error ? null : data
  }

  async deleteClient(id: string): Promise<boolean> {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    return !error
  }

  async createOrder(order: any): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .insert([{ ...order, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      .select().single()
    return error ? null : data
  }

  async createMerchant(merchant: Omit<Merchant, 'id' | 'created_at' | 'updated_at'>): Promise<Merchant | null> {
    const { data, error } = await supabase
      .from('merchants')
      .insert([{ ...merchant, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      .select().single()
    return error ? null : data
  }
}

export const db = new SupabaseClient()
