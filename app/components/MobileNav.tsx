'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@/app/context/UserContext'
import LogRaceSearch from './LogRaceSearch'
import SearchModal from './SearchModal'

export default function MobileNav() {
  const { user } = useUser()
  const router = useRouter()
  const path = usePathname()
  const [showLogSearch, setShowLogSearch] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  function handleLogRace() {
    if (!user) { router.push('/login'); return }
    setMoreOpen(false)
    setShowLogSearch(true)
  }

  function isActive(href: string) {
    return path === href
  }

  return (
    <>
      {/* More drawer — slides up from bottom nav */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 590,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            }}
          />
          {/* Drawer */}
          <div style={{
            position: 'fixed', bottom: 57, left: 0, right: 0, zIndex: 595,
            background: 'var(--off-black)', borderTop: '1px solid var(--border)',
            padding: '8px 0 4px',
          }}>
            {/* Auth-gated links */}
            {user ? (
              <>
                <MoreLink href="/log" label="My Log" icon={
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                } active={isActive('/log')} onClick={() => setMoreOpen(false)} />
                <MoreLink href="/watchlist" label="Watchlist" icon={
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                } active={isActive('/watchlist')} onClick={() => setMoreOpen(false)} />
                <MoreLink href="/stats" label="Stats" icon={
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                } active={isActive('/stats')} onClick={() => setMoreOpen(false)} />
              </>
            ) : null}

            {/* Always-visible links */}
            <MoreLink href="/members" label="Members" icon={
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            } active={isActive('/members')} onClick={() => setMoreOpen(false)} />

            {/* Sign out / sign in */}
            {user ? null : (
              <MoreLink href="/login" label="Sign In" icon={
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
              } active={false} onClick={() => setMoreOpen(false)} />
            )}
          </div>
        </>
      )}

      {/* Bottom nav bar */}
      <div className="mob-nav" id="mob-nav">
        <div className="mob-nav-inner">

          {/* Discover */}
          <Link href="/" className={`mob-nav-btn${isActive('/') ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            Discover
          </Link>

          {/* Top Races */}
          <Link href="/top" className={`mob-nav-btn${isActive('/top') ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Top
          </Link>

          {/* Log Race — centre CTA */}
          <button
            onClick={handleLogRace}
            className="mob-nav-btn"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }}
          >
            <span style={{
              position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="#000" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </span>
            <span style={{ marginTop: 22, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ml)' }}>Log</span>
          </button>

          {/* Profile or Search */}
          {user ? (
            <Link href="/profile" className={`mob-nav-btn${isActive('/profile') ? ' active' : ''}`}>
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Profile
            </Link>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="mob-nav-btn"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Search
            </button>
          )}

          {/* More */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={`mob-nav-btn${moreOpen ? ' active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" fill="currentColor"/>
              <circle cx="12" cy="12" r="1" fill="currentColor"/>
              <circle cx="12" cy="19" r="1" fill="currentColor"/>
            </svg>
            More
          </button>

        </div>
      </div>

      {showLogSearch && <LogRaceSearch onClose={() => setShowLogSearch(false)} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </>
  )
}

// Helper component for More drawer rows
function MoreLink({
  href, label, icon, active, onClick,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 24px',
        textDecoration: 'none',
        color: active ? 'var(--gold)' : 'var(--white)',
        borderBottom: '1px solid var(--border)',
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        letterSpacing: 0.5,
        transition: 'background .1s',
      }}
    >
      <span style={{ color: active ? 'var(--gold)' : 'var(--ml)', flexShrink: 0 }}>{icon}</span>
      {label}
      {active && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />}
    </Link>
  )
}
