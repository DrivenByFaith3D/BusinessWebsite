import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ETSY_SCOPES } from '@/lib/etsy-oauth'

export const dynamic = 'force-dynamic'

const PKCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-'

function randomPkce(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += PKCE_CHARS[bytes[i] % PKCE_CHARS.length]
  return out
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const keystring = process.env.ETSY_KEYSTRING?.trim()
  const callbackUrl = process.env.ETSY_CALLBACK_URL?.trim()
  if (!keystring || !callbackUrl) {
    return NextResponse.json(
      { error: 'ETSY_KEYSTRING and ETSY_CALLBACK_URL must be set.' },
      { status: 503 },
    )
  }

  const codeVerifier = randomPkce(64)
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest())
  const state = randomPkce(32)

  // Sweep abandoned flows so this table can't grow unbounded.
  await prisma.etsyOAuthState.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
  })
  await prisma.etsyOAuthState.create({ data: { state, codeVerifier } })

  const url = new URL('https://www.etsy.com/oauth/connect')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', keystring)
  url.searchParams.set('redirect_uri', callbackUrl)
  url.searchParams.set('scope', ETSY_SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')

  return NextResponse.redirect(url.toString())
}
