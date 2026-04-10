import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 3600

async function getData(slug: string, year: number) {
  const [raceRes, resultRes, stagesRes, reviewsRes, availYearsRes] = await Promise.all([
    supabase.from('races').select('*').eq('slug', slug).single(),
    supabase.from('race_results').select('*').eq('slug', slug).eq('year', year).maybeSingle(),
    supabase.from('stage_results').select('stage_num, stage_label, stage_date, stage_type, distance_km, winner, winner_team').eq('race_slug', slug).eq('year', year).order('stage_num'),
    supabase.from('race_logs').select('user_id, rating, review, date_watched, created_at, profiles(display_name, handle, avatar_url)').eq('slug', slug).eq('year', year).not('rating', 'is', null).gt('rating', 0).order('created_at', { ascending: false }).limit(20),
    supabase.from('race_results').select('year').eq('slug', slug).order('year', { ascending: false }),
  ])
  return {
    race: raceRes.data,
    result: resultRes.data,
    stages: stagesRes.data || [],
    reviews: reviewsRes.data || [],
    availYears: (availYearsRes.data || []).map((r: { year: number }) => r.year),
  }
}

function formatRiderName(name: string | null | undefined): string {
  if (!name) return ''
  return name.split(' ').map(w => {
    if (w === w.toUpperCase() && w.length > 1) return w.charAt(0) + w.slice(1).toLowerCase()
    return w
  }).join(' ')
}

export default async function EditionPage({ params }: { params: { slug: string; year: string } }) {
  const year = parseInt(params.year)
  const { race, result, stages, reviews, availYears } = await getData(params.slug, year)
  if (!race) notFound()

  const isStageRace = race.race_type
    ? ['Grand Tour', 'Stage Race'].includes(race.race_type)
    : false

  const top10: string[] = Array.isArray(result?.top10) ? result.top10 : []

  const prevYear = availYears.find((y: number) => y < year)
  const nextYear = [...availYears].reverse().find((y: number) => y > year)

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null

  return (
    <div>
      {/* Header bar */}
      <div style={{ background: 'var(--bg)', padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/races/${params.slug}`} className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back</Link>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', flex: 1 }}>
          {race.race_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href={nextYear ? `/races/${params.slug}/${nextYear}` : '#'} className="bs" style={{ fontSize: 11, padding: '5px 10px', textDecoration: 'none', opacity: nextYear ? 1 : 0.3, pointerEvents: nextYear ? 'auto' : 'none' }}>‹</Link>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--gold)' }}>{year}</span>
          <Link href={prevYear ? `/races/${params.slug}/${prevYear}` : '#'} className="bs" style={{ fontSize: 11, padding: '5px 10px', textDecoration: 'none', opacity: prevYear ? 1 : 0.3, pointerEvents: prevYear ? 'auto' : 'none' }}>›</Link>
        </div>
      </div>

      <div className="race-sub-layout">
        <div className="rsp-main">
          {/* Banner */}
          <div className="rsp-banner" style={{ background: race.gradient || '#1a1a1a' }}>
            {race.logo_url && <img src={race.logo_url} alt={race.race_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 20, opacity: 0.85 }} />}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="rsp-ttl">{race.race_name}</div>
              <span className="rsp-sub">{year} Edition</span>
            </div>
          </div>

          {/* Winner */}
          {top10[0] && (
            <div className="rsp-section">
              <div className="rsp-st">Winner</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 4 }}>
                {formatRiderName(top10[0])}
              </div>
            </div>
          )}

          {/* Stages */}
          {isStageRace && stages.length > 0 && (
            <div className="rsp-section">
              <div className="rsp-st">Stages</div>
              <div className="stage-list">
                {stages.map(s => (
                  <Link key={s.stage_num} href={`/races/${params.slug}/${year}/stages/${s.stage_num}`} className="srow" style={{ textDecoration: 'none' }}>
                    <span className="snum">{s.stage_num}</span>
                    <div className="sinfo">
                      <div className="sname">{s.stage_label || `Stage ${s.stage_num}`}</div>
                      <div className="sdate">{s.winner ? formatRiderName(s.winner) : (s.stage_date || '')}</div>
                    </div>
                    {s.distance_km && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{s.distance_km}km</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Community reviews */}
          {reviews.length > 0 && (
            <div className="rsp-section">
              <div className="rsp-st">Community Reviews</div>
              {reviews.map((r: any) => {
                const p = r.profiles as any
                if (!r.review) return null
                return (
                  <div key={r.user_id} className="community-review-row">
                    <div className="community-review-meta">
                      <span className="community-review-handle">@{p?.handle || 'cyclist'}</span>
                      {r.rating && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--gold)' }}>{r.rating.toFixed(1)}</span>}
                    </div>
                    <div className="community-review-text">{r.review}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="rsp-sidebar">
          {top10.length > 0 && (
            <>
              <div className="rsp-st">Top 10</div>
              <div>
                {top10.slice(0, 10).map((name: string, i: number) => (
                  <div key={i} className="top10-row">
                    <span className="t10-pos">{i + 1}</span>
                    <Link href={`/riders/${encodeURIComponent(name)}`} style={{ fontSize: 13, flex: 1, textDecoration: 'none', color: 'inherit' }}>
                      {formatRiderName(name)}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}

          {avgRating && (
            <div style={{ marginTop: 24 }}>
              <div className="rsp-st">Avg Rating</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--gold)' }}>
                {avgRating}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2 }}>{reviews.length} ratings</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
