import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 600

async function getLeaderboard() {
  const { data: logs } = await supabase
    .from('race_logs')
    .select('slug, rating')
    .not('rating', 'is', null)
    .gt('rating', 0)

  const { data: races } = await supabase
    .from('races')
    .select('slug, race_name, race_type, country, flag, gradient, swatch')

  if (!logs || !races) return []

  const raceMap = Object.fromEntries(races.map(r => [r.slug, r]))
  const stats: Record<string, { total: number; count: number }> = {}

  for (const log of logs) {
    if (!stats[log.slug]) stats[log.slug] = { total: 0, count: 0 }
    stats[log.slug].total += log.rating
    stats[log.slug].count++
  }

  return Object.entries(stats)
    .filter(([, s]) => s.count >= 2)
    .map(([slug, s]) => ({
      slug,
      race: raceMap[slug],
      avg: s.total / s.count,
      count: s.count,
    }))
    .filter(e => e.race)
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 50)
}

export default async function TopPage() {
  const leaderboard = await getLeaderboard()

  return (
    <>
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">TOP</div>
        <div className="eyebrow">— Community Rankings</div>
        <h1>Greatest <em>races</em> ever.</h1>
      </div>
      <div style={{ padding: '24px 40px 12px', fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3 }}>
        Rankings
      </div>
      <div>
        {leaderboard.map((entry, i) => (
          <Link key={entry.slug} href={`/races/${entry.slug}`} className="lbi" style={{ textDecoration: 'none' }}>
            <div className={`lbrank${i < 3 ? ' pod' : ''}`}>{i + 1}</div>
            <div style={{ width: 5, height: 40, background: entry.race.gradient || '#333', flexShrink: 0 }} />
            <div className="lbinfo">
              <div className="lbname">{entry.race.race_name}</div>
              <div className="lbsub">{entry.race.flag} {entry.race.country} · {entry.race.race_type}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="lbsc">{entry.avg.toFixed(1)}</div>
              <div className="lbsc-s">{entry.count} ratings</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
