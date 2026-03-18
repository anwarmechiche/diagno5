import crypto from "crypto"

const SECRET = process.env.OAUTH_STATE_SECRET || ""

type StatePayload = {
  merchantId: string
  provider: "google" | "microsoft"
  iat: number
  nonce: string
}

const b64 = (buf: Buffer) => buf.toString("base64url")

export function createSignedState(payload: Omit<StatePayload, "iat" | "nonce">) {
  if (!SECRET) throw new Error("OAUTH_STATE_SECRET manquant")

  const full: StatePayload = {
    ...payload,
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  }

  const raw = JSON.stringify(full)
  const data = Buffer.from(raw, "utf8")
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest()
  return `${b64(data)}.${b64(sig)}`
}

export function verifySignedState(state: string): StatePayload {
  if (!SECRET) throw new Error("OAUTH_STATE_SECRET manquant")
  const [dataB64, sigB64] = String(state || "").split(".")
  if (!dataB64 || !sigB64) throw new Error("state invalide")

  const data = Buffer.from(dataB64, "base64url")
  const sig = Buffer.from(sigB64, "base64url")
  const expected = crypto.createHmac("sha256", SECRET).update(data).digest()

  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    throw new Error("state signature invalide")
  }

  const payload = JSON.parse(data.toString("utf8")) as StatePayload
  if (!payload?.merchantId || !payload?.provider) throw new Error("state incomplet")
  return payload
}
