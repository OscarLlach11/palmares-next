'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import EditProfileModal from '@/app/components/EditProfileModal'

function formatRiderName(name: string | null | undefined): string {
  if (!name) return ''
  return name.split(' ').map(w => {
    if (w === w.toUpperCase() && w.length > 1) return w.charAt(0) + w.slice(1).toLowerCase()
    return w
  }).join(' ')
}

function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c','#00594a','#c0392b','#9a8430','#4527a0','#00838f','#6d4c41','#1a4db3']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

function riderInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Profile = {
  user_id: string
  display_name: string
  handle: string
  avatar_url: string | null
  fav_riders: any[]
  fav_race_slug: string | null
  fav_race_year: number | null
}
type RaceLog = {
  id: string
  slug: string
  year: number
  rating: number | null
  review: string | null
  watched_live: boolean
  date_watched: string | null
  created_at: string
}
type Race = { slug: string; race_name: string; gradient: string; flag: string; country: string; logo_url: string | null }

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading: authLoading, refreshProfile } = useUser()
  const [loading, setLoading] = useState(true)
  const [localProfile, setLocalProfile] = useState<Profile | null>(null)
  const [logs, setLogs] = useState<RaceLog[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [riderImages, setRiderImages] = useState<Record<string, string>>({})
  const [favRace, setFavRace] = useState<Race | null>(null)
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    loadAll(user.id)
  }, [user, authLoading])

  async function loadAll(uid: string) {
    const [profRes, logsRes, racesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('race_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('races').select('slug,race_name,gradient,flag,country,logo_url'),
    ])
    const prof = profRes.data as Profile | null
    const allLogs = (logsRes.data || []) as RaceLog[]
    const allRaces = (racesRes.data || []) as Race[]
    setLocalProfile(prof)
    setLogs(allLogs)
    setRaces(allRaces)

    // Follower counts
    const [fersRes, fingRes] = await Promise.all([
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', uid),
    ])
    setFollowers(fersRes.count || 0)
    setFollowing(fingRes.count || 0)

    // Fav race
    if (prof?.fav_race_slug) {
      const fr = allRaces.find(r => r.slug === prof.fav_race_slug)
      if (fr) setFavRace(fr)
    }

    // Rider images
    if (prof?.fav_riders?.length) {
      const names = prof.fav_riders.filter(Boolean).map((r: any) => typeof r === 'string' ? r : r?.name).filter(Boolean)
      if (names.length) {
        const { data: slRows } = await supabase.from('startlists').select('rider_name,image_url').in('rider_name', names).order('year', { ascending: false }).limit(200)
        const map: Record<string, string> = {}
        ;(slRows || []).forEach((r: any) => { if (r.image_url && r.image_url !== 'none') map[r.rider_name] = r.image_url })
        setRiderImages(map)
      }
    }
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  if (!user) return (
    <div className="hero">
      <div className="hero-bg">PROFILE</div>
      <div className="eyebrow">— Your Account</div>
      <h1>My <em>Profile</em></h1>
      <p className="hero-sub" style={{ marginTop: 16 }}>Sign in to view your profile, stats, and race log.</p>
      <Link href="/login" className="bp" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>Sign In</Link>
    </div>
  )

  // Use profile from context (updates after EditProfileModal saves)
  const displayProfile = profile || localProfile

  // Stats
  const rated = logs.filter(l => l.rating && l.rating > 0)
  const avg = rated.length ? (rated.reduce((s, l) => s + (l.rating || 0), 0) / rated.length).toFixed(1) : '—'
  const liveCount = logs.filter(l => l.watched_live).length
  const initials = (displayProfile?.display_name || 'C').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Rating distribution (0.5–5 in 0.5 steps)
  const buckets: Record<string, number> = {}
  for (let v = 0.5; v <= 5.0; v += 0.5) buckets[v.toFixed(1)] = 0
  rated.forEach(l => {
    const k = (Math.round((l.rating || 0) * 2) / 2).toFixed(1)
    if (buckets[k] !== undefined) buckets[k]++
  })
  const maxBucket = Math.max(...Object.values(buckets), 1)

  // By year
  const byYear: Record<number, { count: number; ratings: number[] }> = {}
  logs.forEach(l => {
    if (!byYear[l.year]) byYear[l.year] = { count: 0, ratings: [] }
    byYear[l.year].count++
    if (l.rating) byYear[l.year].ratings.push(l.rating)
  })
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  // Countries
  const countryCounts: Record<string, number> = {}
  logs.forEach(l => {
    const r = races.find(x => x.slug === l.slug)
    if (r?.country) {
      const key = `${r.flag || ''} ${r.country}`.trim()
      countryCounts[key] = (countryCounts[key] || 0) + 1
    }
  })
  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])

  // Recent activity
  const recent = logs.slice(0, 5)

  // Recent reviews
  const withReviews = logs.filter(l => l.review?.trim()).slice(0, 5)

  return (
    <>
    <div className="profile-layout">
      {/* Column 1: stats */}
      <div className="profile-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div className="profile-avatar" style={{ cursor: 'pointer' }} onClick={() => setEditProfileOpen(true)}>
            {displayProfile?.avatar_url
              ? <img src={displayProfile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : initials}
          </div>
          <div>
            <div className="profile-name">{(displayProfile?.display_name || 'Cyclist').toUpperCase()}</div>
            <div className="profile-handle">@{displayProfile?.handle || 'cyclist'}</div>
          </div>
        </div>

        <div className="profile-stat-grid">
          {[
            [logs.length, 'Races'],
            [liveCount, 'Live'],
            [avg, 'Avg ★'],
            [followers, 'Followers'],
            [following, 'Following'],
          ].map(([n, l]) => (
            <div key={String(l)} className="profile-stat-cell">
              <div className="profile-stat-n">{n}</div>
              <div className="profile-stat-l">{l}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8 }}>
          <button className="bs" style={{ width: '100%', fontSize: 9, padding: 8 }}
            onClick={() => setEditProfileOpen(true)}>
            ✏ Edit Profile
          </button>
        </div>

        {/* Rating distribution */}
        <div style={{ marginTop: 24 }}>
          <div className="profile-section-title" style={{ fontSize: 13, marginBottom: 12 }}>Rating Distribution</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
            {Object.entries(buckets).map(([v, cnt]) => (
              <div key={v} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', background: 'var(--gold)', borderRadius: 2, height: maxBucket > 0 ? Math.max(cnt / maxBucket * 52, cnt > 0 ? 2 : 0) : 0 }} />
                <div style={{ fontSize: 8, color: 'var(--muted)' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* By year */}
        <div style={{ marginTop: 24 }}>
          <div className="profile-section-title" style={{ fontSize: 13, marginBottom: 12 }}>By Year</div>
          {years.map(y => {
            const yd = byYear[y]
            const yAvg = yd.ratings.length ? (yd.ratings.reduce((a, b) => a + b, 0) / yd.ratings.length).toFixed(1) : '—'
            return (
              <div key={y} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2 }}>{y}</span>
                <span style={{ color: 'var(--muted)' }}>{yd.count} edition{yd.count !== 1 ? 's' : ''}</span>
                <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif" }}>★ {yAvg}</span>
              </div>
            )
          })}
          {years.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No races logged yet.</div>}
        </div>
      </div>

      {/* Column 2: fav riders + fav race */}
      <div className="profile-main" style={{ borderRight: '1px solid var(--border)' }}>
        <div className="profile-section-title">Favourite Riders</div>
        <div className="fav-riders-grid">
          {(displayProfile?.fav_riders || [null, null, null, null]).slice(0, 4).map((rider: any, i: number) => {
            const name = typeof rider === 'string' ? rider : rider?.name
            const imgUrl = riderImages[name] || (typeof rider === 'object' ? rider?.imageUrl : null)
            if (name) {
              const col = riderColor(name)
              const ini = riderInitials(name)
              return (
                <div key={i} className="fav-rider-slot filled" style={{ position: 'relative' }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                    : <div style={{ width: '100%', height: '100%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#fff' }}>{ini}</div>}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '4px 5px', fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.2 }}>
                    {formatRiderName(name)}
                  </div>
                </div>
              )
            }
            return (
              <div key={i} className="fav-rider-slot" style={{ background: 'var(--card-bg)', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{ fontSize: 20, color: 'var(--border-light)' }}>+</div>
                <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: 1 }}>RIDER {i + 1}</div>
              </div>
            )
          })}
        </div>

        <div className="profile-section-title" style={{ marginTop: 28 }}>Favourite Race</div>
        {favRace ? (
          <div className="fav-race-card">
            <div className="fav-race-swatch" style={{ background: favRace.gradient }}>
              {favRace.logo_url && <img src={favRace.logo_url} alt={favRace.race_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />}
            </div>
            <div className="fav-race-info">
              <div className="fav-race-name">{favRace.race_name}</div>
              <div className="fav-race-year">{displayProfile?.fav_race_year} edition</div>
              <div className="fav-race-label">★ All-time favourite</div>
            </div>
          </div>
        ) : (
          <div className="fav-race-card" style={{ cursor: 'default', borderStyle: 'dashed' }}>
            <div className="fav-race-swatch" style={{ background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--border-light)' }}>★</div>
            <div className="fav-race-info">
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>No favourite race set yet.</div>
            </div>
          </div>
        )}
      </div>

      {/* Column 3: countries, activity, reviews */}
      <div className="profile-main">
        <div className="profile-section-title">Countries Watched</div>
        {sortedCountries.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sortedCountries.map(([country, cnt]) => (
              <div key={country} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '5px 10px', fontSize: 11, letterSpacing: 1 }}>
                <span>{country}</span>
                <span style={{ color: 'var(--muted)', fontSize: 10 }}>{cnt}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ color: 'var(--muted)', fontSize: 12 }}>Log some races to see countries.</div>}

        <div className="profile-section-title" style={{ marginTop: 28 }}>Recent Activity</div>
        {recent.length > 0 ? recent.map(l => {
          const r = races.find(x => x.slug === l.slug)
          return (
            <Link key={l.id} href={`/races/${l.slug}/${l.year}`} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', textDecoration: 'none' }}>
              <div style={{ width: 40, height: 40, flexShrink: 0, background: r?.gradient || 'var(--border)', borderRadius: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{r?.race_name || l.slug} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{l.year}</span></div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {[l.date_watched ? fmtDate(l.date_watched) : '', l.watched_live ? '🔴 Live' : '', l.rating ? `★ ${l.rating}` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
            </Link>
          )
        }) : <div style={{ color: 'var(--muted)', fontSize: 12 }}>No logged races yet.</div>}

        <div className="profile-section-title" style={{ marginTop: 28 }}>Recent Reviews</div>
        {withReviews.length > 0 ? withReviews.map(l => {
          const r = races.find(x => x.slug === l.slug)
          return (
            <Link key={l.id} href={`/races/${l.slug}/${l.year}`} style={{ display: 'block', padding: '12px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>
                {r?.race_name || l.slug} {l.year}{l.rating ? ` · ★ ${l.rating}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{(l.review || '').slice(0, 220)}{(l.review || '').length > 220 ? '…' : ''}"
              </div>
            </Link>
          )
        }) : <div style={{ color: 'var(--muted)', fontSize: 12 }}>Write a review when logging a race — it will appear here.</div>}
      </div>
    </div>

    {editProfileOpen && (
      <EditProfileModal onClose={() => {
        setEditProfileOpen(false)
        if (user) loadAll(user.id)
      }} />
    )}
    </>
  )
}
