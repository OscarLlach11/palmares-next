import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LogEditionButton from '@/app/components/LogEditionButton'
import WatchlistButton from '@/app/components/WatchlistButton'
import EditionComments from '@/app/components/EditionComments'
import EditionStartlist from '@/app/components/EditionStartlist'
import { formatRiderName } from '@/lib/utils'

export const revalidate = 3600

async function getData(slug: string, year: number) {
  const [raceRes, resultRes, stagesRes, reviewsRes, availYearsRes] = await Promise.all([
    supabase.from('races').select('*').eq('slug', slug).single(),
    supabase.from('race_results').select('*').eq('slug', slug).eq('year', year).maybeSingle(),
    supabase.from('stage_results')
      .select('stage_num, stage_label, stage_date, stage_type, distance_km, winner, winner_team')
      .eq('race_slug', slug).eq('year', year).order('stage_num'),
    supabase.from('race_logs')
      .select('user_id, rating, review, date_watched, created_at, profiles(display_name, handle, avatar_url)')
      .eq('slug', slug).eq('year', year)
      .not('rating', 'is', null).gt('rating', 0)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('race_results').select('year').eq('slug', slug).order('year', { ascending: false }),
  ])

  let result = resultRes.data

  // Fallback: try race_slug column if slug column returned nothing
  if (!result) {
    const fallback = await supabase
      .from('race_results')
      .select('*')
      .eq('race_slug', slug)
      .eq('year', year)
      .maybeSingle()
    result = fallback.data
  }

  return {
    race: raceRes.data,
    result,
    stages: stagesRes.data || [],
    reviews: reviewsRes.data || [],
    availYears: (availYearsRes.data || []).map((r: { year: number }) => r.year),
  }
}

// Extract the rider name string from a top10 entry.
// The DB stores top10 as either plain strings ("POGACAR Tadej") or
// objects ({ rider: "POGACAR Tadej", time: "...", gap: "..." }).
// This matches the original index.html handling exactly.
function extractTop10Name(entry: any): string {
  if (typeof entry === 'string') return entry
  return entry?.rider || entry?.rider_name || ''
}

function extractTop10Gap(entry: any): string {
  if (typeof entry !== 'object' || !entry) return ''
  return entry.gap || entry.time || ''
}

export default async function EditionPage({ params }: { params: { slug: string; year: string } }) {
  const year = parseInt(params.year)
  const { race, result, stages, reviews, availYears } = await getData(params.slug, year)
  if (!race) notFound()

  const isStageRace = race.race_type
    ? ['Grand Tour', 'Stage Race'].includes(race.race_type)
    : false

  // top10 can be string[] or object[] — normalise to raw DB name strings
  const rawTop10: any[] = Array.isArray(result?.top10) ? result.top10 : []

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
          <Link href={nextYear ? `/races/${params.slug}/${nextYear}` : '#'} className="bs"
            style={{ fontSize: 11, padding: '5px 10px', textDecoration: 'none', opacity: nextYear ? 1 : 0.3, pointerEvents: nextYear ? 'auto' : 'none' }}>‹</Link>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--gold)' }}>{year}</span>
          <Link href={prevYear ? `/races/${params.slug}/${prevYear}` : '#'} className="bs"
            style={{ fontSize: 11, padding: '5px 10px', textDecoration: 'none', opacity: prevYear ? 1 : 0.3, pointerEvents: prevYear ? 'auto' : 'none' }}>›</Link>
        </div>
      </div>

      <div className="race-sub-layout">
        <div className="rsp-main">
          {/* Banner */}
          <div className="rsp-banner" style={{ background: race.gradient || '#1a1a1a' }}>
            {race.logo_url && (
              <img src={race.logo_url} alt={race.race_name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 20, opacity: 0.85 }} />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="rsp-ttl">{race.race_name}</div>
              <span className="rsp-sub">{year} Edition</span>
            </div>
          </div>

          {/* Winner — always uses formatRiderName to flip to "First Last" */}
          {rawTop10[0] && extractTop10Name(rawTop10[0]) && (
            <div className="rsp-section">
              <div className="rsp-st">Winner</div>
              <Link href={`/riders/${encodeURIComponent(extractTop10Name(rawTop10[0]))}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 4, color: 'var(--gold)' }}>
                  {formatRiderName(extractTop10Name(rawTop10[0]))}
                </div>
              </Link>
            </div>
          )}

          {/* Log + Watchlist buttons */}
          <div className="rsp-section" style={{ paddingTop: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <LogEditionButton
              slug={params.slug}
              raceName={race.race_name}
              gradient={race.gradient || '#1a1a1a'}
              year={year}
              availYears={availYears}
            />
            <WatchlistButton slug={params.slug} />
          </div>

          {/* Stages */}
          {isStageRace && stages.length > 0 && (
            <div className="rsp-section">
              <div className="rsp-st">Stages</div>
              <div className="stage-list">
                {stages.map((s: any) => (
                  <Link key={s.stage_num} href={`/races/${params.slug}/${year}/stages/${s.stage_num}`}
                    className="srow" style={{ textDecoration: 'none' }}>
                    <span className="snum">{s.stage_num === 0 ? 'P' : s.stage_num}</span>
                    <div className="sinfo">
                      <div className="sname">{s.stage_label || `Stage ${s.stage_num}`}</div>
                      <div className="sdate">
                        {s.winner ? formatRiderName(s.winner) : (s.stage_date || '')}
                      </div>
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

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <div className="rsp-sidebar">

          {/* Top 10 results */}
          {rawTop10.length > 0 && (
            <>
              <div className="rsp-st">Top 10</div>
              <div style={{ marginBottom: 24 }}>
                {rawTop10.slice(0, 10).map((entry: any, i: number) => {
                  const name = extractTop10Name(entry)
                  const gap = extractTop10Gap(entry)
                  if (!name) return null
                  return (
                    <div key={i} className="top10-row">
                      <span className="t10-pos">{i + 1}</span>
                      <Link
                        href={`/riders/${encodeURIComponent(name)}`}
                        style={{ fontSize: 13, flex: 1, textDecoration: 'none', color: 'inherit' }}
                      >
                        {formatRiderName(name)}
                      </Link>
                      {gap && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>{gap}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* No results fallback */}
          {rawTop10.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, fontStyle: 'italic' }}>
              No results for {year}.{' '}
              <a href={`https://www.procyclingstats.com/race/${params.slug}/${year}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--gold-dim)' }}>
                View on PCS ↗
              </a>
            </div>
          )}

          {/* Average rating */}
          {avgRating && (
            <div style={{ marginBottom: 24 }}>
              <div className="rsp-st">Avg Rating</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--gold)' }}>
                {avgRating}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2 }}>
                {reviews.length} rating{reviews.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Edition year navigation */}
          {availYears.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <div className="rsp-st">Editions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 200, overflowY: 'auto' }}>
                {availYears.map((y: number) => (
                  <Link key={y} href={`/races/${params.slug}/${y}`} style={{
                    padding: '6px 10px', fontSize: 12, textDecoration: 'none',
                    background: y === year ? 'rgba(232,200,74,.1)' : 'transparent',
                    color: y === year ? 'var(--gold)' : 'var(--muted)',
                    borderLeft: y === year ? '2px solid var(--gold)' : '2px solid transparent',
                  }}>
                    {y}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <EditionStartlist slug={params.slug} year={year} />
        </div>
      </div>
    </div>
  )
}
