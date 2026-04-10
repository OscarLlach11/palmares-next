import type { Metadata } from 'next'
import './globals.css'
import Nav from './components/Nav'
import { UserProvider } from './context/UserContext'

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
          <Nav />
          <main>{children}</main>
          <MobileNav />
        </UserProvider>
      </body>
    </html>
  )
}

function MobileNav() {
  return (
    <div className="mob-nav" id="mob-nav">
      <div className="mob-nav-inner">
        <a href="/" className="mob-nav-btn">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          Discover
        </a>
        <a href="/top" className="mob-nav-btn">
          <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
          Top
        </a>
        <a href="/members" className="mob-nav-btn">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          Members
        </a>
        <a href="/log" className="mob-nav-btn">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          My Log
        </a>
        <a href="/profile" className="mob-nav-btn">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          Profile
        </a>
      </div>
    </div>
  )
}
