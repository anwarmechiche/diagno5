// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Fonctions spécifiques pour les settings
export const getMerchantSettings = async (merchantId: string) => {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(String(merchantId))) return null

    const { data, error } = await supabase
      .from('merchant_settings')
      .select('*')
      .eq('merchant_id', merchantId)
      .single()

    if (error) {
      console.error('Get merchant settings error:', error)
      return null
    }
    return data
  } catch (error) {
    console.error('Get merchant settings exception:', error)
    return null
  }
}

export const saveMerchantSettings = async (settings: any) => {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(String(settings?.merchant_id || ''))) return false

    const { error } = await supabase
      .from('merchant_settings')
      .upsert(settings, {
        onConflict: 'merchant_id'
      })

    if (error) {
      console.error('Save merchant settings error:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Save merchant settings exception:', error)
    return false
  }
}

export const uploadLogo = async (merchantId: string, file: File) => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${merchantId}-${Date.now()}.${fileExt}`
    const filePath = `merchant-logos/${fileName}`
    
    const { error } = await supabase.storage
      .from('merchant-assets')
      .upload(filePath, file)
    
    if (error) {
      console.error('Upload logo error:', error)
      return null
    }
    
    const { data } = supabase.storage
      .from('merchant-assets')
      .getPublicUrl(filePath)
    
    return { url: data.publicUrl }
  } catch (error) {
    console.error('Upload logo exception:', error)
    return null
  }
}
