'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c', '#00594a', '#c0392b', '#9a8430', '#4527a0', '#00838f', '#6d4c41', '#1a4db3']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

function riderInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function formatRiderName(name: string) {
  if (!name) return ''
  return name.split(' ').map(w => w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w).join(' ')
}

export default function UserProfilePage() {
  const params = useParams()
  const handle = params.handle as string
  const { user, profile: myProfile, followingIds, toggleFollow } = useUser()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [races, setRaces] = useState<Record<string, any>>({})
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [riderImages, setRiderImages] = useState<Record<string, string>>({})
  const [favRace, setFavRace] = useState<any>(null)
  const [stageCount, setStageCount] = useState(0)

  const isMe = user && (myProfile?.handle === handle || user.id === handle)
  const isFollowing = profile ? followingIds.has(profile.user_id) : false

  useEffect(() => { load() }, [handle])

  async function load() {
    setLoading(true)

    // Load profile by handle
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('handle', handle).maybeSingle()

    if (!prof) { setNotFound(true); setLoading(false); return }
    setProfile(prof)

    const [logsRes, racesRes, fersRes, fingRes, stageCountRes] = await Promise.all([
      supabase.from('race_logs').select('id,slug,year,rating,review,watched_live,date_watched,created_at').eq('user_id', prof.user_id).order('created_at', { ascending: false }),
      supabase.from('races').select('slug,race_name,gradient,flag,country,logo_url'),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', prof.user_id),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', prof.user_id),
      supabase.from('stage_logs').select('id', { count: 'exact', head: true }).eq('user_id', prof.user_id),
    ])

    const allLogs = logsRes.data || []
    setLogs(allLogs)
    setFollowers(fersRes.count || 0)
    setFollowing(fingRes.count || 0)
    setStageCount(stageCountRes.count || 0)

    const raceMap: Record<string, any> = {}
    ;(racesRes.data || []).forEach((r: any) => { raceMap[r.slug] = r })
    setRaces(raceMap)

    if (prof.fav_race_slug) setFavRace(raceMap[prof.fav_race_slug] || null)

    // Rider images
    const riderNames = (prof.fav_riders || [])
      .filter(Boolean)
      .map((r: any) => typeof r === 'string' ? r : r?.name)
      .filter(Boolean)
    if (riderNames.length) {
      const { data: slRows } = await supabase.from('startlists').select('rider_name,image_url').in('rider_name', riderNames).order('year', { ascending: false }).limit(200)
      const map: Record<string, string> = {}
      ;(slRows || []).forEach((r: any) => { if (r.image_url && r.image_url !== 'none') map[r.rider_name] = r.image_url })
      setRiderImages(map)
    }

    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>
  if (notFound) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      User not found.
      <div style={{ marginTop: 12 }}><Link href="/members" className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back to Members</Link></div>
    </div>
  )

  // Stats
  const rated = logs.filter(l => l.rating && l.rating > 0)
  const avg = rated.length ? (rated.reduce((s: number, l: any) => s + (l.rating || 0), 0) / rated.length).toFixed(1) : '—'
  const liveCount = logs.filter(l => l.watched_live).length
  const initials = (profile?.display_name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  // Rating distribution
  const buckets: Record<string, number> = {}
  for (let v = 0.5; v <= 5.0; v += 0.5) buckets[v.toFixed(1)] = 0
  rated.forEach((l: any) => {
    const k = (Math.round((l.rating || 0) * 2) / 2).toFixed(1)
    if (buckets[k] !== undefined) buckets[k]++
  })
  const maxBucket = Math.max(...Object.values(buckets), 1)

  // By year
  const byYear: Record<number, { count: number; ratings: number[] }> = {}
  logs.forEach((l: any) => {
    if (!byYear[l.year]) byYear[l.year] = { count: 0, ratings: [] }
    byYear[l.year].count++
    if (l.rating) byYear[l.year].ratings.push(l.rating)
  })
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  // Countries
  const countryCounts: Record<string, number> = {}
  logs.forEach((l: any) => {
    const r = races[l.slug]
    if (r?.country) {
      const key = `${r.flag || ''} ${r.country}`.trim()
      countryCounts[key] = (countryCounts[key] || 0) + 1
    }
  })
  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])

  const recent = logs.slice(0, 5)
  const withReviews = logs.filter((l: any) => l.review?.trim()).slice(0, 5)

  return (
    <div className="profile-layout">
      {/* Column 1: stats */}
      <div className="profile-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div className="profile-avatar" style={{ cursor: 'default' }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : initials}
          </div>
          <div style={{ flex: 1 }}>
            <div className="profile-name">{(profile?.display_name || 'Cyclist').toUpperCase()}</div>
            <div className="profile-handle">@{profile?.handle || 'cyclist'}</div>
          </div>
        </div>

        {/* Back + Follow */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <Link href="/members" className="bs" style={{ textDecoration: 'none', fontSize: 10, padding: '6px 12px', flexShrink: 0 }}>← Back</Link>
          {!isMe && user && (
            <button onClick={() => toggleFollow(profile.user_id)}
              className={`follow-btn ${isFollowing ? 'following' : 'follow'}`} style={{ flex: 1 }}>
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          {isMe && (
            <Link href="/profile" className="bs" style={{ textDecoration: 'none', fontSize: 10, flex: 1, textAlign: 'center' }}>Edit Profile →</Link>
          )}
        </div>

        {/* Stats grid */}
        <div className="profile-stat-grid">
          {[
            [logs.length, 'Races', null],
            [liveCount, 'Live', null],
            [avg, 'Avg ★', null],
            [stageCount, 'Stages', null],
            [followers, 'Followers', `/profile/${profile?.handle}/followers`],
            [following, 'Following', `/profile/${profile?.handle}/following`],
          ].map(([n, l, href]) => (
            href ? (
              <Link key={String(l)} href={href as string} className="profile-stat-cell clickable" style={{ textDecoration: 'none' }}>
                <div className="profile-stat-n">{n}</div>
                <div className="profile-stat-l">{l}</div>
              </Link>
            ) : (
              <div key={String(l)} className="profile-stat-cell">
                <div className="profile-stat-n">{n}</div>
                <div className="profile-stat-l">{l}</div>
              </div>
            )
          ))}
        </div>

        {/* Rating distribution */}
        <div style={{ marginTop: 24 }}>
          <div className="profile-section-title" style={{ fontSize: 13, marginBottom: 12 }}>Rating Distribution</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
            {Object.entries(buckets).map(([v, cnt]) => (
              <div key={v} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', background: 'var(--gold)', borderRadius: 2, height: maxBucket > 0 ? Math.max(cnt / maxBucket * 52, cnt > 0 ? 2 : 0) : 0 }} />
                <div style={{ fontSize: 7, color: 'var(--muted)' }}>{v}</div>
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
          {(profile?.fav_riders || [null, null, null, null]).slice(0, 4).map((rider: any, i: number) => {
            const name = typeof rider === 'string' ? rider : rider?.name
            const imgUrl = riderImages[name] || (typeof rider === 'object' ? rider?.imageUrl : null)
            if (name) {
              const col = riderColor(name)
              const ini = riderInitials(name)
              return (
                <Link key={i} href={`/riders/${encodeURIComponent(name)}`} className="fav-rider-slot filled" style={{ position: 'relative', textDecoration: 'none' }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                    : <div style={{ width: '100%', height: '100%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#fff' }}>{ini}</div>}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '4px 5px', fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.2, color: '#fff' }}>
                    {formatRiderName(name)}
                  </div>
                </Link>
              )
            }
            return <div key={i} className="fav-rider-slot" style={{ background: 'var(--card-bg)', border: '1px dashed var(--border)' }} />
          })}
        </div>

        <div className="profile-section-title" style={{ marginTop: 28 }}>Favourite Race</div>
        {favRace ? (
          <Link href={`/races/${favRace.slug}${profile?.fav_race_year ? `/${profile.fav_race_year}` : ''}`} className="fav-race-card" style={{ textDecoration: 'none' }}>
            <div className="fav-race-swatch" style={{ background: favRace.gradient }}>
              {favRace.logo_url && <img src={favRace.logo_url} alt={favRace.race_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />}
            </div>
            <div className="fav-race-info">
              <div className="fav-race-name">{favRace.race_name}</div>
              {profile?.fav_race_year && <div className="fav-race-year">{profile.fav_race_year} edition</div>}
              <div className="fav-race-label">★ All-time favourite</div>
            </div>
          </Link>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>No favourite race set.</div>
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
        ) : <div style={{ color: 'var(--muted)', fontSize: 12 }}>No logged races yet.</div>}

        <div className="profile-section-title" style={{ marginTop: 28 }}>Recent Activity</div>
        {recent.length > 0 ? recent.map((l: any) => {
          const r = races[l.slug]
          return (
            <Link key={l.id} href={`/races/${l.slug}/${l.year}`} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
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
        {withReviews.length > 0 ? withReviews.map((l: any) => {
          const r = races[l.slug]
          return (
            <Link key={l.id} href={`/review/${handle}/${l.slug}/${l.year}`} style={{ display: 'block', padding: '12px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>
                {r?.race_name || l.slug} {l.year}{l.rating ? ` · ★ ${l.rating}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{(l.review || '').slice(0, 220)}{(l.review || '').length > 220 ? '…' : ''}"
              </div>
            </Link>
          )
        }) : <div style={{ color: 'var(--muted)', fontSize: 12 }}>No reviews yet.</div>}
      </div>
    </div>
  )
}
