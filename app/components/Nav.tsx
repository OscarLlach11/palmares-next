'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@/app/context/UserContext'

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const { user, profile, signOut } = useUser()

  const initials = (profile?.display_name || user?.email || 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  const navLink = (href: string, label: string) => (
    <Link href={href} className={`nav-a${path === href ? ' active' : ''}`}>{label}</Link>
  )

  return (
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
        {user && navLink('/profile', 'Profile')}

        {user ? (
          <>
            <Link href="/log" className="nav-a nav-cta">+ Log Race</Link>
            <button
              onClick={handleSignOut}
              style={{ background: 'none', border: 'none', color: 'var(--ml)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: 0 }}>
              Sign Out
            </button>
            <Link href="/profile" style={{
              width: 30, height: 30, borderRadius: '50%', background: 'var(--gold)', color: '#000',
              fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif",
            }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : initials}
            </Link>
          </>
        ) : (
          <Link href="/login" className="nav-a nav-cta">Sign In</Link>
        )}
      </div>
    </nav>
  )
}
