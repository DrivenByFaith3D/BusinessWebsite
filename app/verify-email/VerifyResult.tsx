import Link from 'next/link'

export default function VerifyResult({
  state,
  title,
  message,
  showResend,
}: {
  state: 'success' | 'error'
  title: string
  message: string
  showResend?: boolean
}) {
  const success = state === 'success'
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-md text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${
          success ? 'bg-green-100 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {success ? (
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <h1 className="text-xl font-bold text-charcoal mb-2">{title}</h1>
        <p className="text-warm-gray text-sm mb-6">{message}</p>
        <Link href="/login" className="btn-primary w-full inline-block text-center">
          {success ? 'Sign In' : 'Back to Sign In'}
        </Link>
        {showResend && (
          <p className="text-warm-gray text-xs mt-3">
            On the sign in page, enter your email and choose &ldquo;Resend verification email&rdquo;.
          </p>
        )}
      </div>
    </div>
  )
}
