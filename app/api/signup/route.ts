import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, verificationEmailHtml } from '@/lib/brevo'
import { rateLimit } from '@/lib/rate-limit'
import { VERIFICATION_TTL_MS } from '@/lib/verification'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)
  if (!success) return NextResponse.json({ error: 'Too many signups. Try again later.' }, { status: 429 })

  const { email, password, name, street, city, state, zip } = await req.json()

  if (!email || !password || password.length < 6 || !name) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'ACCOUNT_EXISTS' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 10)

  const adminEmail = process.env.ADMIN_EMAIL
  const isAdmin = adminEmail && email === adminEmail
  const role = isAdmin ? 'admin' : 'user'
  const verificationToken = isAdmin ? null : randomUUID()

  const user = await prisma.user.create({
    data: {
      email, password: hashed, name, role,
      emailVerified: isAdmin ? true : false,
      verificationToken,
      verificationTokenExpires: verificationToken ? new Date(Date.now() + VERIFICATION_TTL_MS) : null,
    },
  })

  if (street && city && state && zip) {
    await prisma.address.create({
      data: { userId: user.id, label: 'Home', street, city, state, zip, country: 'US', isDefault: true },
    })
  }

  // Track whether the verification email actually went out. Reporting success
  // when it silently failed leaves the account unusable with no way to recover.
  let emailSent = true
  if (!isAdmin && verificationToken) {
    try {
      const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()
      await sendEmail({
        to: email,
        toName: name,
        subject: 'Verify your email, DrivenByFaith3D',
        htmlContent: verificationEmailHtml(`${appUrl}/verify-email?token=${verificationToken}`),
      })
    } catch (e) {
      emailSent = false
      console.error('Verification email failed:', e)
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    needsVerification: !isAdmin,
    emailSent,
  })
}
