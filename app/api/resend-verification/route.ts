import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, verificationEmailHtml } from '@/lib/brevo'
import { rateLimit } from '@/lib/rate-limit'
import { VERIFICATION_TTL_MS } from '@/lib/verification'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await rateLimit(`resend-verification:${ip}`, 5, 60 * 60 * 1000)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Always report success so this can't be used to probe which emails have
  // accounts. Nothing to do for unknown or already-verified accounts.
  if (!user || user.emailVerified) return NextResponse.json({ ok: true })

  const verificationToken = randomUUID()
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  })

  try {
    const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()
    await sendEmail({
      to: user.email,
      toName: user.name ?? undefined,
      subject: 'Verify your email, DrivenByFaith3D',
      htmlContent: verificationEmailHtml(`${appUrl}/verify-email?token=${verificationToken}`),
    })
  } catch (e) {
    console.error('Resend verification email failed:', e)
    return NextResponse.json(
      { error: 'We could not send the email right now. Please try again shortly.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
