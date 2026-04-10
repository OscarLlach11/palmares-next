'use client'
import { useState } from 'react'
import { useUser } from '@/app/context/UserContext'
import LogRaceSearch from './LogRaceSearch'
import SearchModal from './SearchModal'
import { useRouter } from 'next/navigation'

export default function MobileNav() {
  const { user } = useUser()
  const router = useRouter()
  const [showLogSearch, setShowLogSearch] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  function handleLogRace() {
    if (!user) { router.push('/login'); return }
    setShowLogSearch(true)
  }

  return (
    <>
      <div className="mob-nav" id="mob-nav">
        <div className="mob-nav-inner">
          <a href="/" className="mob-nav-btn">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Discover
          </a>
          <a href="/top" className="mob-nav-btn">
            <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Top
          </a>
          <button onClick={handleLogRace} className="mob-nav-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Log Race
          </button>
          <button onClick={() => setShowSearch(true)} className="mob-nav-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search
          </button>
          {user ? (
            <a href="/profile" className="mob-nav-btn">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Profile
            </a>
          ) : (
            <a href="/login" className="mob-nav-btn">
              <svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Sign In
            </a>
          )}
        </div>
      </div>

      {showLogSearch && <LogRaceSearch onClose={() => setShowLogSearch(false)} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </>
  )
}
