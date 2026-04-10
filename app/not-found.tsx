import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 120, letterSpacing: 4, color: 'var(--gold)', lineHeight: 1, opacity: 0.15 }}>404</div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, fontStyle: 'italic', marginTop: -20, marginBottom: 16 }}>
          Page not found
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 28 }}>
          This page doesn't exist — or maybe the race hasn't been logged yet.
        </p>
        <Link href="/" className="bp" style={{ textDecoration: 'none', display: 'inline-block' }}>
          ← Back to Discover
        </Link>
      </div>
    </div>
  )
}
