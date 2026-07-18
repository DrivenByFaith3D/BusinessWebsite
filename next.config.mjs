
// Content-Security-Policy. Kept practical for a Next.js app: 'unsafe-inline'
// is required for Next's injected styles/scripts, and we allow the third parties
// the app actually talks to (Stripe, Supabase blob/images, Etsy images).
const csp = [
  "default-src 'self'",
  // ajax.googleapis + gstatic: the model-viewer library that renders STL previews.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://ajax.googleapis.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://i.etsystatic.com https://*.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.blob.vercel-storage.com https://api.stripe.com https://photon.komoot.io https://ajax.googleapis.com https://www.gstatic.com",
  "worker-src 'self' blob:",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Product images pulled from Etsy listings by the shop sync.
      {
        protocol: 'https',
        hostname: 'i.etsystatic.com',
      },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
