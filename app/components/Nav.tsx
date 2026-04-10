'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

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
        {user ? (
          <button onClick={signOut} className="nav-a" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sign Out
          </button>
        ) : (
          <Link href="/login" className="nav-a nav-cta">Sign In</Link>
        )}
      </div>
    </nav>
  )
}
