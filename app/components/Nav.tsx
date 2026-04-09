'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const path = usePathname()

  return (
    <nav>
      <Link href="/" className="logo">
        <span className="logo-word">PALMARÈS</span>
        <span className="logo-sub">Cycling Race Journal</span>
      </Link>
      <div className="nav-links">
        <Link href="/" className={`nav-a${path === '/' ? ' active' : ''}`}>Discover</Link>
        <Link href="/top" className={`nav-a${path === '/top' ? ' active' : ''}`}>Top Races</Link>
        <Link href="/members" className={`nav-a${path === '/members' ? ' active' : ''}`}>Members</Link>
        <Link href="/log" className={`nav-a${path === '/log' ? ' active' : ''}`}>My Log</Link>
        <Link href="/profile" className={`nav-a${path === '/profile' ? ' active' : ''}`}>Profile</Link>
        <Link href="/log" className="nav-a nav-cta">+ Log Race</Link>
      </div>
    </nav>
  )
}
