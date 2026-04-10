'use client'

import Link from 'next/link'

export default function EditionLink({ href, year }: { href: string; year: number }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        transition: 'border-color .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-dim)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2 }}>{year}</span>
      <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2 }}>View Edition →</span>
    </Link>
  )
}
