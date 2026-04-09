import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 3600

function formatRiderName(name: string): string {
  if (!name) return ''
  return name.split(' ').map(w =>
    w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w
  ).join(' ')
}

async function getRiderData(rawName: string) {
  const name = decodeURIComponent(rawName)
  const displayName = formatRiderName(name)

  // Get rider info from startlists
  const { data: startlistRows } = await supabase
    .from('startlists')
    .select('rider_name, team_name, nationality, image_url, year')
    .ilike('rider_name', name)
    .order('year', { ascending: false })
    .limit(20)

  const info = startlistRows?.[0] || null
  const imageUrl = startlistRows?.find(r => r.image_url && r.image_url !== 'none')?.image_url || null

  // Get win history
  const { data: wins } = await supabase
    .from('rider_wins')
    .select('race_slug, year')
    .ilike('rider_name', `%${name.split(' ').pop() || name}%`)
    .order('year', { ascending: false })
    .limit(50)

  // Get race history from race_results top10
  let results: { slug: string; year: number; top10: string[] }[] = []
  try {
    const { data } = await supabase
      .from('race_results')
      .select('slug, year, top10')
      .contains('top10', JSON.stringify([name]))
      .order('year', { ascending: false })
      .limit(50)
    results = data || []
  } catch { results = [] }

  // Get race names
  const slugs = [...new Set([...(wins || []).map(w => w.race_slug), ...(results || []).map(r => r.slug)])]
  const { data: races } = await supabase
    .from('races')
    .select('slug, race_name, gradient, swatch, flag')
    .in('slug', slugs)

  const raceMap = Object.fromEntries((races || []).map(r => [r.slug, r]))

  return { name, displayName, info, imageUrl, wins: wins || [], results: results || [], raceMap }
}

const PALETTE = ['#c0392b','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
function riderColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

export default async function RiderPage({ params }: { params: { name: string } }) {
  const { name, displayName, info, imageUrl, wins, results, raceMap } = await getRiderData(params.name)

  const col = riderColor(name)
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Merge wins and top10 appearances into a race history
  const historyMap: Record<string, { slug: string; year: number; won: boolean }> = {}
  for (const w of wins) {
    const key = `${w.race_slug}-${w.year}`
    historyMap[key] = { slug: w.race_slug, year: w.year, won: true }
  }
  for (const r of results) {
    const key = `${r.slug}-${r.year}`
    if (!historyMap[key]) historyMap[key] = { slug: r.slug, year: r.year, won: false }
  }

  const history = Object.values(historyMap).sort((a, b) => b.year - a.year)
  const totalWins = wins.length

  return (
    <div>
      {/* Back button */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--black)', padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back</Link>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {/* Rider header */}
        <div className="rider-page-header">
          {imageUrl ? (
            <img src={imageUrl} alt={displayName} style={{ width: 100, aspectRatio: '2/3', objectFit: 'cover', objectPosition: 'center top', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 100, aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center', background: col, fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#fff', flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div>
            <div className="rider-page-name">{displayName}</div>
            <div className="rider-page-meta">
              {[info?.nationality, info?.team_name].filter(Boolean).join(' · ')}
            </div>
            <div className="rider-page-meta" style={{ marginTop: 6 }}>
              {history.length} race{history.length !== 1 ? 's' : ''} in database
              {totalWins > 0 && ` · ${totalWins} win${totalWins !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>

        {/* Race history */}
        {history.length > 0 ? (
          <div style={{ marginTop: 32 }}>
            <div className="rsp-st">Race History</div>
            {history.map(h => {
              const race = raceMap[h.slug]
              if (!race) return null
              return (
                <Link key={`${h.slug}-${h.year}`} href={`/races/${h.slug}/${h.year}`} className="rider-race-row" style={{ textDecoration: 'none' }}>
                  <div style={{ width: 32, height: 32, background: race.gradient || '#333', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 1 }}>{race.race_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{h.year}</div>
                  </div>
                  {h.won && (
                    <span style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 1, border: '1px solid var(--gold)', padding: '2px 6px', flexShrink: 0 }}>WIN</span>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="empty">No race history found for this rider.</div>
        )}
      </div>
    </div>
  )
}
