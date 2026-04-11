import type { Metadata } from 'next'
import './globals.css'
import Nav from './components/Nav'
import MobileNav from './components/MobileNav'
import { UserProvider } from './context/UserContext'
import { ToastProvider } from './context/ToastContext'

export const metadata: Metadata = {
  title: 'PALMARÈS — Cycling Race Journal',
  description: "Log and rate the cycling races you've watched. Follow friends, explore community rankings, and build your palmarès.",
  openGraph: {
    type: 'website',
    url: 'https://palmares.pro',
    title: 'PALMARÈS — Cycling Race Journal',
    description: "Log and rate the cycling races you've watched.",
    images: [{ url: 'https://palmares.pro/og-image.png', width: 1200, height: 630 }],
    siteName: 'Palmarès',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PALMARÈS — Cycling Race Journal',
    description: "Log and rate the cycling races you've watched.",
    images: ['https://palmares.pro/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <meta name="theme-color" content="#0d0d0d" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap"
          rel="stylesheet"
        />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-67KD9D5PPH" />
        <script dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-67KD9D5PPH');
          `
        }} />
      </head>
      <body>
        <UserProvider>
          <ToastProvider>
            <Nav />
            <main>{children}</main>
            <MobileNav />
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  )
}
