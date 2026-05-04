import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import Navbar from '@/components/Navbar'
import Providers from '@/components/Providers'
import PasswordChangeGate from '@/components/PasswordChangeGate'

export const metadata: Metadata = {
  title: {
    default: 'DrivenByFaith3D',
    template: '%s | DrivenByFaith3D',
  },
  description: 'We specialize in high-quality 3D printed desk organizers. Every print is made to order.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'DrivenByFaith3D',
    description: 'High-quality 3D printed desk organizers, made to order.',
    siteName: 'DrivenByFaith3D',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Navbar />
          <PasswordChangeGate />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-taupe/30 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
                <div>
                  <p className="font-display text-lg text-charcoal mb-1">DrivenByFaith3D</p>
                  <p className="text-warm-gray text-xs">Made with care, printed with precision.</p>
                </div>
                <div className="text-center">
                  <p className="text-warm-gray font-medium mb-1 text-xs uppercase tracking-wide">Location</p>
                  <p className="text-charcoal text-sm">Based in the USA</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-warm-gray font-medium mb-1 text-xs uppercase tracking-wide">Contact</p>
                  <p className="text-charcoal text-sm">drivenbyfaith3d@gmail.com</p>
                </div>
              </div>
              <div className="border-t border-taupe/30 mt-8 pt-6 text-center">
                <p className="text-warm-gray text-xs">&copy; {new Date().getFullYear()} DrivenByFaith3D. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  )
}
