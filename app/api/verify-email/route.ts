import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, welcomeEmailHtml } from '@/lib/brevo'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { verificationToken: token } })
  if (!user) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
    return NextResponse.json({ error: 'EXPIRED' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null, verificationTokenExpires: null },
  })

  try {
    const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()
    await sendEmail({
      to: user.email,
      toName: user.name ?? undefined,
      subject: 'Welcome to DrivenByFaith3D, you\'re verified!',
      htmlContent: welcomeEmailHtml(appUrl),
    })
  } catch (e) {
    // Non-fatal: the account is verified either way.
    console.error('Welcome email failed:', e)
  }

  return NextResponse.json({ ok: true })
}
