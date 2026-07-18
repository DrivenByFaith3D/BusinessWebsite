import { prisma } from './prisma'

// OAuth layer for private Etsy data (orders/receipts and writing tracking back).
// Public listing/review reads live in lib/etsy.ts and need no token.

const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token'
const ETSY_API = 'https://openapi.etsy.com/v3/application'
const REFRESH_BUFFER_MS = 5 * 60 * 1000

// Both scopes: read receipts, and write shipment tracking back to Etsy.
export const ETSY_SCOPES = 'transactions_r transactions_w'

export class EtsyNotConnectedError extends Error {
  constructor() {
    super('Etsy is not connected. Connect it from the admin area.')
    this.name = 'EtsyNotConnectedError'
  }
}

function keystring(): string {
  const key = process.env.ETSY_KEYSTRING?.trim()
  if (!key) throw new Error('ETSY_KEYSTRING is not set')
  return key
}

// This app's key requires the shared secret in x-api-key (verified against the
// live API), so authenticated calls send keystring:secret plus the bearer token.
export function oauthHeaders(accessToken: string): Record<string, string> {
  const secret = process.env.ETSY_SHARED_SECRET?.trim()
  return {
    'x-api-key': secret ? `${keystring()}:${secret}` : keystring(),
    Authorization: `Bearer ${accessToken}`,
  }
}

export async function isEtsyConnected(): Promise<boolean> {
  const row = await prisma.etsyToken.findUnique({ where: { id: 'shop' } })
  return !!row
}

export async function getConnection(): Promise<{ shopId: string; updatedAt: Date } | null> {
  const row = await prisma.etsyToken.findUnique({ where: { id: 'shop' } })
  return row ? { shopId: row.shopId, updatedAt: row.updatedAt } : null
}

export async function saveTokens(
  shopId: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
  scope?: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)
  await prisma.etsyToken.upsert({
    where: { id: 'shop' },
    create: { id: 'shop', shopId, accessToken, refreshToken, expiresAt, scope },
    update: { shopId, accessToken, refreshToken, expiresAt, ...(scope ? { scope } : {}) },
  })
}

// Returns a live access token, refreshing it first if it is close to expiring.
export async function getValidAccessToken(): Promise<{ accessToken: string; shopId: string }> {
  const row = await prisma.etsyToken.findUnique({ where: { id: 'shop' } })
  if (!row) throw new EtsyNotConnectedError()

  if (row.expiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return { accessToken: row.accessToken, shopId: row.shopId }
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: keystring(),
      refresh_token: row.refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    // A dead refresh token means the grant is gone and the shop must reconnect.
    if (res.status === 400 || res.status === 401) {
      await prisma.etsyToken.delete({ where: { id: 'shop' } }).catch(() => {})
      throw new EtsyNotConnectedError()
    }
    throw new Error(`Etsy token refresh failed: ${res.status} ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
  await saveTokens(row.shopId, data.access_token, data.refresh_token, data.expires_in)
  return { accessToken: data.access_token, shopId: row.shopId }
}

// Authenticated GET against the Etsy API, refreshing the token as needed.
export async function etsyAuthedGet<T>(path: string): Promise<T> {
  const { accessToken } = await getValidAccessToken()
  const res = await fetch(`${ETSY_API}${path}`, { headers: oauthHeaders(accessToken), cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Etsy ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

export async function etsyAuthedPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { accessToken } = await getValidAccessToken()
  const res = await fetch(`${ETSY_API}${path}`, {
    method: 'POST',
    headers: { ...oauthHeaders(accessToken), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(
      Object.entries(body).reduce((acc, [k, v]) => {
        if (v != null) acc[k] = String(v)
        return acc
      }, {} as Record<string, string>),
    ),
  })
  if (!res.ok) {
    throw new Error(`Etsy ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}
