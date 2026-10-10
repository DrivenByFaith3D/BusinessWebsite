import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { oauthHeaders, saveTokens, ETSY_SCOPES } from '@/lib/etsy-oauth'
import { missingEtsyScopes } from '@/lib/etsy-scopes'
import { resolveShopId, etsyShopName } from '@/lib/etsy'

export const dynamic = 'force-dynamic'

const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token'

// Redirect back to the admin products page with a short status message.
function back(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/products', req.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const denied = searchParams.get('error')

  if (denied) return back(req, { etsy: 'denied' })
  if (!code || !state) return back(req, { etsy: 'error' })

  // State is single-use: consume it so a replayed callback can't reuse the PKCE.
  const stored = await prisma.etsyOAuthState.findUnique({ where: { state } })
  if (!stored || stored.createdAt.getTime() < Date.now() - 15 * 60000) return back(req, { etsy: 'expired' })
  await prisma.etsyOAuthState.delete({ where: { state } }).catch(() => {})

  const keystring = process.env.ETSY_KEYSTRING?.trim()
  const callbackUrl = process.env.ETSY_CALLBACK_URL?.trim()
  if (!keystring || !callbackUrl) return back(req, { etsy: 'error' })

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: keystring,
        redirect_uri: callbackUrl,
        code,
        code_verifier: stored.codeVerifier,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[etsy:callback] token exchange failed', tokenRes.status, (await tokenRes.text()).slice(0, 300))
      return back(req, { etsy: 'error' })
    }

    const token = (await tokenRes.json()) as { access_token: string; refresh_token: string; expires_in: number; scope?: string }
    // Etsy access tokens are "{userId}.{token}".
    const userId = token.access_token.split('.')[0]

    // getShopByOwnerUserId returns a single Shop object, but has been seen as an
    // array/{results} too, so accept every shape rather than assume one.
    let shopId: number | undefined
    const shopsRes = await fetch(`https://openapi.etsy.com/v3/application/users/${userId}/shops`, {
      headers: oauthHeaders(token.access_token),
    })
    const shopsBody = await shopsRes.text()
    if (shopsRes.ok) {
      try {
        const parsed = JSON.parse(shopsBody) as Record<string, unknown>
        const asAny = parsed as { shop_id?: number; results?: { shop_id?: number }[] }
        shopId =
          asAny.shop_id ??
          asAny.results?.[0]?.shop_id ??
          (Array.isArray(parsed) ? (parsed[0] as { shop_id?: number })?.shop_id : undefined)
      } catch {
        /* fall through to the configured-shop fallback */
      }
    } else {
      console.error('[etsy:callback] shop lookup', shopsRes.status, shopsBody.slice(0, 200))
    }

    // Keep the working grant until the new account and private listing reads
    // are verified. Connecting another Etsy account must not replace this shop.
    const configuredShopId = await resolveShopId(etsyShopName())
    if (!shopId || shopId !== configuredShopId) return back(req, { etsy: 'wrongshop' })
    if (token.scope && missingEtsyScopes(token.scope).length)
      return back(req, { etsy: 'permissions' })
    const listingsRes = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active?limit=1`,
      { headers: oauthHeaders(token.access_token), cache: 'no-store' },
    )
    if (!listingsRes.ok) return back(req, { etsy: 'permissions' })
    const listings = await listingsRes.json() as { results?: { listing_id: number }[] }
    const listingId = listings.results?.[0]?.listing_id
    if (listingId) {
      for (const resource of ['inventory', 'shipping']) {
        const probe = await fetch(
          `https://openapi.etsy.com/v3/application/listings/batch/${resource}?listing_ids=${listingId}`,
          { headers: oauthHeaders(token.access_token), cache: 'no-store' },
        )
        if (!probe.ok) return back(req, { etsy: 'permissions' })
      }
    }

    await saveTokens(String(shopId), token.access_token, token.refresh_token, token.expires_in, token.scope || ETSY_SCOPES)
    return back(req, { etsy: 'connected' })
  } catch (e) {
    console.error('[etsy:callback] error', e instanceof Error ? e.message : e)
    return back(req, { etsy: 'error' })
  }
}
