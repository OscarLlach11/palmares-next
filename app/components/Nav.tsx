'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useUser } from '@/app/context/UserContext'
import LogRaceSearch from './LogRaceSearch'
import NotificationBell from './NotificationBell'
import SearchModal from './SearchModal'

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const { user, profile, signOut } = useUser()
  const [showLogSearch, setShowLogSearch] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const initials = (profile?.display_name || user?.email || 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  function handleLogRace() {
    if (!user) { router.push('/login'); return }
    setShowLogSearch(true)
  }

  const navLink = (href: string, label: string) => (
    <Link href={href} className={`nav-a${path === href ? ' active' : ''}`}>{label}</Link>
  )

  return (
    <>
      <nav>
        <Link href="/" className="logo">
          <span className="logo-word">PALMARÈS</span>
          <span className="logo-sub">Cycling Race Journal</span>
        </Link>
        <div className="nav-links">
          {navLink('/', 'Discover')}
          {navLink('/top', 'Top Races')}
          {navLink('/members', 'Members')}
          {user && navLink('/log', 'My Log')}
          {user && navLink('/watchlist', 'Watchlist')}
          {user && navLink('/stats', 'Stats')}
          {user && navLink('/profile', 'Profile')}

          {/* Search button */}
          <button onClick={() => setShowSearch(true)}
            style={{ background: 'none', border: 'none', color: 'var(--ml)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
            title="Search races & riders">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {user ? (
            <>
              <button onClick={handleLogRace} className="nav-a nav-cta">+ Log Race</button>
              <NotificationBell />
              <button
                onClick={handleSignOut}
                style={{ background: 'none', border: 'none', color: 'var(--ml)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: 0 }}>
                Sign Out
              </button>
              <Link href="/profile" style={{
                width: 30, height: 30, borderRadius: '50%', background: 'var(--gold)', color: '#000',
                fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden',
              }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </Link>
            </>
          ) : (
            <Link href="/login" className="nav-a nav-cta">Sign In</Link>
          )}
        </div>
      </nav>

      {showLogSearch && <LogRaceSearch onClose={() => setShowLogSearch(false)} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </>
  )
}
