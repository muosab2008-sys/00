import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/auth-context'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: 'MrCash - Earn Rewards & Cash',
  description: 'Earn real cash rewards by completing offers, surveys, and tasks. Join MrCash today!',
  generator: 'v0.app',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background" data-scroll-behavior="smooth">
      <body className={`${_geist.variable} ${_geistMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
          <Toaster 
            position="top-center" 
            richColors 
            theme="dark"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              },
            }}
          />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
