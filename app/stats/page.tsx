'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

function formatRiderName(name: string): string {
  if (!name) return ''
  return name.split(' ').map(w =>
    w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w
  ).join(' ')
}

interface RaceLog {
  id: string; slug: string; year: number; rating: number | null
  watched_live: boolean; created_at: string
}
interface Race {
  slug: string; race_name: string; gradient: string; flag: string
  country: string; race_type: string
}

export default function StatsPage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<RaceLog[]>([])
  const [races, setRaces] = useState<Record<string, Race>>({})
  const [riderWins, setRiderWins] = useState<any[]>([])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    load(user.id)
  }, [user])

  async function load(uid: string) {
    // Step 1: fetch logs and races in parallel
    const [logsRes, racesRes] = await Promise.all([
      supabase.from('race_logs').select('id,slug,year,rating,watched_live,created_at').eq('user_id', uid),
      supabase.from('races').select('slug,race_name,gradient,flag,country,race_type'),
    ])

    const userLogs: RaceLog[] = logsRes.data || []
    const raceMap: Record<string, Race> = {}
    ;(racesRes.data || []).forEach((r: any) => { raceMap[r.slug] = r })

    setLogs(userLogs)
    setRaces(raceMap)

    // Step 2: fetch rider_wins only for slugs the user has actually logged.
    // This is the key fix: the old code fetched ALL rider_wins (potentially
    // thousands of rows) and then tried to intersect in memory using
    // rider_wins.race_slug vs race_logs.slug. If those two columns store
    // slugs in even slightly different formats, the intersection returns
    // nothing. By scoping the query to only the user's logged slugs we also
    // make the query much smaller and faster.
    const loggedSlugs = [...new Set(userLogs.map(l => l.slug))]

    if (loggedSlugs.length > 0) {
      const { data: winsData } = await supabase
        .from('rider_wins')
        .select('rider_name,race_slug,year')
        .in('race_slug', loggedSlugs)

      setRiderWins(winsData || [])
    } else {
      setRiderWins([])
    }

    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  if (!user) return (
    <div className="hero">
      <div className="hero-bg">STATS</div>
      <div className="eyebrow">— Your Numbers</div>
      <h1>My <em>Stats</em></h1>
      <p className="hero-sub" style={{ marginTop: 16 }}>Sign in to see your personal stats.</p>
      <Link href="/login" className="bp" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>Sign In</Link>
    </div>
  )

  const rated = logs.filter(l => l.rating && l.rating > 0)
  const avg = rated.length
    ? (rated.reduce((s, l) => s + (l.rating || 0), 0) / rated.length).toFixed(2)
    : '—'
  const liveCount = logs.filter(l => l.watched_live).length
  const distinctRaces = new Set(logs.map(l => l.slug)).size

  // Most watched races
  const raceCounts: Record<string, number> = {}
  logs.forEach(l => { raceCounts[l.slug] = (raceCounts[l.slug] || 0) + 1 })
  const topRaces = Object.entries(raceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Most watched countries
  const countryCounts: Record<string, { count: number; flag: string }> = {}
  logs.forEach(l => {
    const r = races[l.slug]
    if (r?.country) {
      if (!countryCounts[r.country]) countryCounts[r.country] = { count: 0, flag: r.flag || '' }
      countryCounts[r.country].count++
    }
  })
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)

  // Most watched riders
  // Build a lookup set of "slug::year" keys from the user's logs.
  // Also build a normalised version (lowercase, trimmed) for each key so
  // minor slug format differences between race_logs.slug and
  // rider_wins.race_slug don't silently break the intersection.
  const loggedKeys = new Set(logs.map(l => `${l.slug}::${l.year}`))
  const loggedKeysNorm = new Set(logs.map(l => `${l.slug.toLowerCase().trim()}::${l.year}`))

  const riderCounts: Record<string, number> = {}
  riderWins.forEach((w: any) => {
    const key = `${w.race_slug}::${w.year}`
    const keyNorm = `${(w.race_slug || '').toLowerCase().trim()}::${w.year}`
    if (loggedKeys.has(key) || loggedKeysNorm.has(keyNorm)) {
      riderCounts[w.rider_name] = (riderCounts[w.rider_name] || 0) + 1
    }
  })
  const topRiders = Object.entries(riderCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Rating distribution
  const buckets: Record<string, number> = {}
  for (let v = 0.5; v <= 5.0; v += 0.5) buckets[v.toFixed(1)] = 0
  rated.forEach(l => {
    const k = (Math.round((l.rating || 0) * 2) / 2).toFixed(1)
    if (buckets[k] !== undefined) buckets[k]++
  })
  const maxBucket = Math.max(...Object.values(buckets), 1)

  // By race type
  const typeCounts: Record<string, number> = {}
  logs.forEach(l => {
    const t = races[l.slug]?.race_type
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1
  })

  // Top rated races (min 1 rating)
  const raceRatings: Record<string, number[]> = {}
  logs.filter(l => l.rating).forEach(l => {
    if (!raceRatings[`${l.slug}::${l.year}`]) raceRatings[`${l.slug}::${l.year}`] = []
    raceRatings[`${l.slug}::${l.year}`].push(l.rating!)
  })
  const topRated = Object.entries(raceRatings)
    .map(([key, ratings]) => ({ key, avg: ratings.reduce((a, b) => a + b, 0) / ratings.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)

  const StatBox = ({ value, label }: { value: string | number; label: string }) => (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '20px 24px' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 2, color: 'var(--gold)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 6 }}>{label}</div>
    </div>
  )

  return (
    <div>
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">STATS</div>
        <div className="eyebrow">— Your Numbers</div>
        <h1>My <em>Stats</em></h1>
      </div>

      <div style={{ padding: '28px 40px', maxWidth: 1100 }}>

        {/* Top stats grid */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 40 }}>
          <StatBox value={logs.length} label="Races Logged" />
          <StatBox value={distinctRaces} label="Distinct Races" />
          <StatBox value={liveCount} label="Watched Live" />
          <StatBox value={rated.length} label="Ratings Given" />
          <StatBox value={avg} label="Avg Rating" />
          <StatBox value={Object.keys(countryCounts).length} label="Countries" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>

          {/* Rating distribution */}
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>Rating Distribution</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 8 }}>
              {Object.entries(buckets).map(([v, cnt]) => (
                <div key={v} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  {cnt > 0 && <div style={{ fontSize: 8, color: 'var(--muted)' }}>{cnt}</div>}
                  <div style={{ width: '100%', background: 'var(--gold)', borderRadius: 2, height: maxBucket > 0 ? Math.max(cnt / maxBucket * 64, cnt > 0 ? 3 : 0) : 0 }} />
                  <div style={{ fontSize: 7, color: 'var(--muted)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* By race type */}
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>By Race Type</div>
            {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, cnt]) => {
              const pct = Math.round(cnt / logs.length * 100)
              return (
                <div key={type} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--muted)', letterSpacing: 1 }}>{type}</span>
                    <span style={{ color: 'var(--gold)' }}>{cnt} <span style={{ color: 'var(--muted)' }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                    <div style={{ height: '100%', background: 'var(--gold)', borderRadius: 2, width: `${pct}%`, transition: 'width .4s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Most watched races */}
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>Most Watched Races</div>
            {topRaces.map(([slug, cnt], i) => {
              const r = races[slug]
              return (
                <Link key={slug} href={`/races/${slug}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: i < 3 ? 'var(--gold)' : 'var(--muted)', width: 24, textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ width: 28, height: 28, background: r?.gradient || 'var(--border)', flexShrink: 0, borderRadius: 2 }} />
                  <div style={{ flex: 1, fontSize: 13 }}>{r?.race_name || slug}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--gold)' }}>{cnt}</div>
                </Link>
              )
            })}
          </div>

          {/* Most watched riders */}
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>Most Watched Riders</div>
            {topRiders.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>Log more races to see rider stats.</div>
              : topRiders.map(([name, cnt], i) => (
                <Link key={name} href={`/riders/${encodeURIComponent(name)}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: i < 3 ? 'var(--gold)' : 'var(--muted)', width: 24, textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13 }}>{formatRiderName(name)}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--gold)' }}>{cnt}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>win{cnt !== 1 ? 's' : ''} seen</div>
                </Link>
              ))
            }
          </div>

          {/* Top rated editions */}
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>Your Top Rated</div>
            {topRated.map(({ key, avg }, i) => {
              const [slug, year] = key.split('::')
              const r = races[slug]
              return (
                <Link key={key} href={`/races/${slug}/${year}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: i < 3 ? 'var(--gold)' : 'var(--muted)', width: 24, textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ width: 28, height: 28, background: r?.gradient || 'var(--border)', flexShrink: 0, borderRadius: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{r?.race_name || slug}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{year}</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--gold)' }}>★ {avg.toFixed(1)}</div>
                </Link>
              )
            })}
          </div>

          {/* Most watched countries */}
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>Most Watched Countries</div>
            {topCountries.map(([country, data], i) => (
              <div key={country} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: i < 3 ? 'var(--gold)' : 'var(--muted)', width: 24, textAlign: 'center' }}>{i + 1}</div>
                <div style={{ fontSize: 16, width: 24 }}>{data.flag}</div>
                <div style={{ flex: 1, fontSize: 13 }}>{country}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--gold)' }}>{data.count}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
