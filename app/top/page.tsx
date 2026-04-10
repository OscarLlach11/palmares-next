import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 3600

async function getTopRaces() {
  // Get all ratings
  const { data: logs } = await supabase
    .from('race_logs')
    .select('slug,year,rating')
    .not('rating', 'is', null)
    .gt('rating', 0)

  if (!logs?.length) return []

  // Aggregate by slug+year
  const map: Record<string, { ratings: number[]; slug: string; year: number }> = {}
  logs.forEach((l: any) => {
    const key = `${l.slug}::${l.year}`
    if (!map[key]) map[key] = { ratings: [], slug: l.slug, year: l.year }
    map[key].ratings.push(l.rating)
  })

  // Filter to at least 2 ratings, compute avg
  const entries = Object.values(map)
    .filter(e => e.ratings.length >= 2)
    .map(e => ({
      slug: e.slug,
      year: e.year,
      avg: e.ratings.reduce((a, b) => a + b, 0) / e.ratings.length,
      count: e.ratings.length,
    }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 100)

  if (!entries.length) return []

  // Fetch race info
  const slugs = [...new Set(entries.map(e => e.slug))]
  const { data: races } = await supabase
    .from('races')
    .select('slug,race_name,gradient,flag,country,race_type,logo_url,tier')
    .in('slug', slugs)

  const raceMap: Record<string, any> = {}
  ;(races || []).forEach((r: any) => { raceMap[r.slug] = r })

  return entries.map(e => ({ ...e, race: raceMap[e.slug] || null })).filter(e => e.race)
}

export default async function TopPage() {
  const entries = await getTopRaces()

  return (
    <div>
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">TOP</div>
        <div className="eyebrow">— Community Rankings</div>
        <h1>Greatest <em>races</em> ever.</h1>
      </div>

      <div style={{ padding: '24px 40px 12px', fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3 }}>
        Rankings
      </div>

      {entries.length === 0 ? (
        <div className="empty">No ratings yet — be the first to log a race!</div>
      ) : (
        <div>
          {entries.map((entry, i) => {
            const r = entry.race
            const isWT = r.tier === 'WT'
            return (
              <Link key={`${entry.slug}-${entry.year}`}
                href={`/races/${entry.slug}/${entry.year}`}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 40px', borderBottom: '1px solid var(--border)', textDecoration: 'none', transition: 'background .1s' }}
                onMouseEnter={undefined}
                className="lpe">
                {/* Position */}
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: i < 3 ? 28 : 20, color: i === 0 ? 'var(--gold)' : i < 3 ? 'var(--fg)' : 'var(--muted)', width: 36, flexShrink: 0, textAlign: 'center' }}>
                  {i + 1}
                </div>

                {/* Race swatch */}
                <div style={{ width: 48, height: 48, background: r.gradient || '#1a1a1a', flexShrink: 0, borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                  {r.logo_url && (
                    <img src={r.logo_url} alt={r.race_name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                      onError={(e: any) => { e.target.style.display = 'none' }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15 }}>{r.race_name}</span>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: 'var(--gold)', letterSpacing: 1 }}>{entry.year}</span>
                    {isWT && <span style={{ fontSize: 8, background: 'var(--gold)', color: '#000', padding: '1px 5px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>WT</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, letterSpacing: 1 }}>
                    {r.flag} {r.country} · {r.race_type}
                  </div>
                </div>

                {/* Rating */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>
                    {entry.avg.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginTop: 2 }}>
                    {entry.count} rating{entry.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
