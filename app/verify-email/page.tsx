import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { sendEmail, welcomeEmailHtml } from '@/lib/brevo'

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams

  if (!token) {
    return <Result success={false} message="No verification token provided." />
  }

  const user = await prisma.user.findUnique({ where: { verificationToken: token } })

  if (!user) {
    return <Result success={false} message="This verification link is invalid or has already been used." />
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null },
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
    console.error('Welcome email failed:', e)
  }

  return <Result success={true} message="Your email has been verified. You can now sign in." />
}

function Result({ success, message }: { success: boolean; message: string }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-md text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${
          success ? 'bg-green-900/50 border border-green-800/50' : 'bg-red-900/50 border border-red-800/50'
        }`}>
          {success ? (
            <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{success ? 'Email Verified' : 'Verification Failed'}</h1>
        <p className="text-zinc-400 text-sm mb-6">{message}</p>
        <Link href="/login" className="btn-primary w-full inline-block text-center">
          {success ? 'Sign In' : 'Back to Login'}
        </Link>
      </div>
    </div>
  )
}
