import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LogEditionButton from '@/app/components/LogEditionButton'
import EditionComments from '@/app/components/EditionComments'
import EditionStartlist from '@/app/components/EditionStartlist'

export const revalidate = 0

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

// Names are now stored as "Firstname Lastname" — no transformation needed.
// This function is kept as a no-op passthrough to avoid breaking any
// remaining call sites during the transition period.
function formatRiderName(name: string | null | undefined): string {
  return name || ''
}

// Safely extract a plain string name from a top10 entry, which may be
// a plain string "Firstname Lastname" or a legacy object {rider, time}.
function extractName(entry: any): string {
  if (typeof entry === 'string') return entry
  return entry?.rider || entry?.rider_name || entry?.name || ''
}

export default async function EditionPage({ params }: { params: { slug: string; year: string } }) {
  const year = parseInt(params.year)
  const { race, result, stages, reviews, availYears } = await getData(params.slug, year)
  if (!race) notFound()

  const isStageRace = race.race_type
    ? ['Grand Tour', 'Stage Race'].includes(race.race_type)
    : false

  // Extract names safely — handles both plain string arrays and legacy object arrays
  const top10: string[] = Array.isArray(result?.top10)
    ? result.top10.map(extractName).filter(Boolean)
    : []

  const prevYear = availYears.find((y: number) => y < year)
  const nextYear = [...availYears].reverse().find((y: number) => y > year)

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--bg)', padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href={`/races/${params.slug}`} className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← All Editions</Link>
        <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', flex: 1, textTransform: 'uppercase' }}>
          {race.race_name}
        </span>
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
              <Link href={`/riders/${encodeURIComponent(top10[0])}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 4, color: 'var(--gold)' }}>
                  {formatRiderName(top10[0])}
                </div>
              </Link>
            </div>
          )}

          {/* Log button */}
          <div className="rsp-section" style={{ paddingTop: 0 }}>
            <LogEditionButton
              slug={params.slug}
              raceName={race.race_name}
              gradient={race.gradient || '#1a1a1a'}
              year={year}
              availYears={availYears}
            />
          </div>

          {/* Stages */}
          {isStageRace && stages.length > 0 && (
            <div className="rsp-section">
              <div className="rsp-st">Stages</div>
              <div className="stage-list">
                {stages.map((s: any) => (
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
                  <Link
                    key={r.user_id}
                    href={`/review/${p?.handle || r.user_id}/${params.slug}/${year}`}
                    className="community-review-row"
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <div className="community-review-meta">
                      <span className="community-review-handle">@{p?.handle || 'cyclist'}</span>
                      {r.rating && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--gold)' }}>{r.rating.toFixed(1)}</span>}
                    </div>
                    <div className="community-review-text">{r.review}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, letterSpacing: 0.5 }}>View full review →</div>
                  </Link>
                )
              })}
            </div>
          )}

          <EditionComments slug={params.slug} year={year} />
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

          <div style={{ marginTop: 24 }}>
            <EditionStartlist slug={params.slug} year={year} />
          </div>
        </div>
      </div>
    </div>
  )
}
