import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin"

export type MerchantEmailProvider = "google" | "microsoft" | "gmail_manual"

export type MerchantEmailAccount = {
  id: string
  merchant_id: string
  provider: MerchantEmailProvider
  email: string
  access_token: string
  refresh_token: string
  expires_at: string | null
  scope: string | null
  token_type: string | null
  created_at: string | null
  updated_at: string | null
}

const TABLE = "merchant_email_accounts"

export async function getMerchantEmailAccount(merchantId: string): Promise<MerchantEmailAccount | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("merchant_id", merchantId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return (data as any) || null
}

export async function upsertMerchantEmailAccount(input: {
  merchantId: string
  provider: MerchantEmailProvider
  email: string
  accessToken: string
  refreshToken: string
  expiresAt: string | null
  scope?: string | null
  tokenType?: string | null
}) {
  const admin = getSupabaseAdmin()
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant (admin requis)")

  const now = new Date().toISOString()

  const payload = {
    merchant_id: input.merchantId,
    provider: input.provider,
    email: input.email,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_at: input.expiresAt,
    scope: input.scope ?? null,
    token_type: input.tokenType ?? null,
    updated_at: now,
  }

  const { data, error } = await admin
    .from(TABLE)
    .upsert(payload, { onConflict: "merchant_id" })
    .select("*")
    .single()

  if (error) throw error
  return data
}

export async function deleteMerchantEmailAccount(merchantId: string) {
  const admin = getSupabaseAdmin()
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant (admin requis)")

  const { error } = await admin.from(TABLE).delete().eq("merchant_id", merchantId)
  if (error) throw error
}
