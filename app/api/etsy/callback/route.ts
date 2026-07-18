import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { oauthHeaders, saveTokens, ETSY_SCOPES } from '@/lib/etsy-oauth'

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
  if (!stored) return back(req, { etsy: 'expired' })
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

    const token = (await tokenRes.json()) as { access_token: string; refresh_token: string; expires_in: number }
    // Etsy access tokens are "{userId}.{token}".
    const userId = token.access_token.split('.')[0]

    const shopsRes = await fetch(`https://openapi.etsy.com/v3/application/users/${userId}/shops`, {
      headers: oauthHeaders(token.access_token),
    })
    if (!shopsRes.ok) {
      console.error('[etsy:callback] shop lookup failed', shopsRes.status, (await shopsRes.text()).slice(0, 300))
      return back(req, { etsy: 'error' })
    }

    const shops = (await shopsRes.json()) as { results?: { shop_id: number }[] }
    const shopId = shops.results?.[0]?.shop_id
    if (!shopId) return back(req, { etsy: 'noshop' })

    await saveTokens(String(shopId), token.access_token, token.refresh_token, token.expires_in, ETSY_SCOPES)
    return back(req, { etsy: 'connected' })
  } catch (e) {
    console.error('[etsy:callback] error', e instanceof Error ? e.message : e)
    return back(req, { etsy: 'error' })
  }
}
