import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LogEditionButton from '@/app/components/LogEditionButton'
import EditionComments from '@/app/components/EditionComments'
import EditionStartlist from '@/app/components/EditionStartlist'

export const revalidate = 3600

async function getData(slug: string, year: number) {
  const [raceRes, resultRes, stagesRes, reviewsRes, availYearsRes] = await Promise.all([
    supabase.from('races').select('*').eq('slug', slug).single(),
    supabase.from('race_results').select('*').eq('slug', slug).eq('year', year).maybeSingle(),
    supabase
      .from('stage_results')
      .select('stage_num, stage_label, stage_date, stage_type, distance_km, winner, winner_team, departure, arrival')
      .eq('race_slug', slug)
      .eq('year', year)
      .order('stage_num'),
    supabase
      .from('race_logs')
      .select('user_id, rating, review, date_watched, created_at, profiles(display_name, handle, avatar_url)')
      .eq('slug', slug)
      .eq('year', year)
      .not('rating', 'is', null)
      .gt('rating', 0)
      .order('created_at', { ascending: false })
      .limit(20),
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
  return name || ''
}

function extractName(entry: any): string {
  if (typeof entry === 'string') return entry
  return entry?.rider || entry?.rider_name || entry?.name || ''
}

// Returns a colour for the top accent bar of a stage card based on stage_type
function stageTypeColor(type: string | null): string {
  if (!type) return 'var(--border-light)'
  const t = type.toLowerCase()
  if (t.includes('tt') || t.includes('time trial') || t.includes('individual time')) return '#a78bfa'
  if (t.includes('mountain') || t.includes('high mountain')) return '#34d399'
  if (t.includes('cobble') || t.includes('pave')) return '#f59e0b'
  if (t.includes('sprint') || t.includes('flat')) return '#60a5fa'
  if (t.includes('hilly') || t.includes('semi')) return '#f97316'
  return 'var(--border-light)'
}

// Returns a short display label for the stage type badge
function stageTypeBadge(type: string | null): string {
  if (!type) return ''
  const t = type.toLowerCase()
  if (t.includes('tt') || t.includes('time trial') || t.includes('individual time')) return 'TT'
  if (t.includes('team time')) return 'TTT'
  if (t.includes('mountain') || t.includes('high mountain')) return 'MTN'
  if (t.includes('cobble') || t.includes('pave')) return 'COB'
  if (t.includes('sprint') || t.includes('flat')) return 'FLAT'
  if (t.includes('hilly') || t.includes('semi')) return 'HILLY'
  return type.toUpperCase().slice(0, 5)
}

export default async function EditionPage({ params }: { params: { slug: string; year: string } }) {
  const year = parseInt(params.year)
  const { race, result, stages, reviews, availYears } = await getData(params.slug, year)
  if (!race) notFound()

  const isStageRace = race.race_type
    ? ['Grand Tour', 'Stage Race'].includes(race.race_type)
    : false

  const top10: string[] = Array.isArray(result?.top10)
    ? result.top10.map(extractName).filter(Boolean)
    : []

  const prevYear = availYears.find((y: number) => y < year)
  const nextYear = [...availYears].reverse().find((y: number) => y > year)

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : null

  return (
    <div>
      {/* Year nav */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          href={`/races/${params.slug}`}
          style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', letterSpacing: 1 }}
        >
          {race.race_name}
        </Link>
        <span style={{ color: 'var(--border-light)', fontSize: 11 }}>/</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link
            href={nextYear ? `/races/${params.slug}/${nextYear}` : '#'}
            className="bs"
            style={{
              fontSize: 11,
              padding: '5px 10px',
              textDecoration: 'none',
              opacity: nextYear ? 1 : 0.3,
              pointerEvents: nextYear ? 'auto' : 'none',
            }}
          >
            ‹
          </Link>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--gold)' }}>{year}</span>
          <Link
            href={prevYear ? `/races/${params.slug}/${prevYear}` : '#'}
            className="bs"
            style={{
              fontSize: 11,
              padding: '5px 10px',
              textDecoration: 'none',
              opacity: prevYear ? 1 : 0.3,
              pointerEvents: prevYear ? 'auto' : 'none',
            }}
          >
            ›
          </Link>
        </div>
      </div>

      <div className="race-sub-layout">
        {/* ── MAIN ─────────────────────────────────────────────── */}
        <div className="rsp-main">
          {/* Banner */}
          <div className="rsp-banner" style={{ background: race.gradient || '#1a1a1a' }}>
            {race.logo_url && (
              <img
                src={race.logo_url}
                alt={race.race_name}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  padding: 20,
                  opacity: 0.85,
                }}
              />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="rsp-ttl">{race.race_name}</div>
              <span className="rsp-sub">{year} Edition</span>
            </div>
          </div>

          {/* Winner — for one-day races or GC winner of stage races */}
          {top10[0] && (
            <div className="rsp-section">
              <div className="rsp-st">{isStageRace ? 'GC Winner' : 'Winner'}</div>
              <Link href={`/riders/${encodeURIComponent(top10[0])}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 22,
                    marginBottom: 4,
                    color: 'var(--gold)',
                  }}
                >
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

          {/* ── STAGES — card grid (stage races & grand tours) ─── */}
          {isStageRace && stages.length > 0 && (
            <div className="rsp-section">
              <div className="rsp-st">
                Stages
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    letterSpacing: 1,
                    color: 'var(--muted)',
                    marginLeft: 10,
                    fontWeight: 400,
                  }}
                >
                  {stages.length} stages
                </span>
              </div>

              <div className="stage-card-grid">
                {stages.map((s: any) => {
                  const label =
                    s.stage_num === 0
                      ? 'Prologue'
                      : s.stage_label
                      ? `Stage ${s.stage_label}`
                      : `Stage ${s.stage_num}`
                  const accentColor = stageTypeColor(s.stage_type)
                  const typeBadge = stageTypeBadge(s.stage_type)
                  const isTT =
                    s.stage_type &&
                    (s.stage_type.toLowerCase().includes('tt') ||
                      s.stage_type.toLowerCase().includes('time trial') ||
                      s.stage_type.toLowerCase().includes('individual time') ||
                      s.stage_type.toLowerCase().includes('team time'))

                  return (
                    <Link
                      key={s.stage_num}
                      href={`/races/${params.slug}/${year}/stages/${s.stage_num}`}
                      className="stage-card"
                    >
                      {/* Top accent bar coloured by stage type */}
                      <div className="stage-card-bar" style={{ background: accentColor }} />

                      <div className="stage-card-inner">
                        {/* Header: stage number + type badge */}
                        <div className="stage-card-header">
                          <span className="stage-card-num" style={{ color: 'var(--ml)' }}>
                            {label}
                          </span>
                          {typeBadge && (
                            <span
                              className="stage-card-type-badge"
                              style={{
                                color: accentColor,
                                borderColor: accentColor,
                              }}
                            >
                              {typeBadge}
                            </span>
                          )}
                        </div>

                        {/* Route: departure → arrival */}
                        {(s.departure || s.arrival) && (
                          <div className="stage-card-route">
                            {s.departure && (
                              <span style={{ color: 'var(--fg)', opacity: 0.75 }}>{s.departure}</span>
                            )}
                            {s.departure && s.arrival && (
                              <span className="stage-card-arrow">→</span>
                            )}
                            {s.arrival && (
                              <span style={{ color: 'var(--fg)', opacity: 0.75 }}>{s.arrival}</span>
                            )}
                          </div>
                        )}

                        {/* Distance */}
                        {s.distance_km && (
                          <div className="stage-card-distance">{s.distance_km} km</div>
                        )}

                        {/* Winner */}
                        {s.winner ? (
                          <div className="stage-card-winner">
                            <span className="stage-card-winner-icon">
                              {isTT ? '⏱' : '🏆'}
                            </span>
                            <span className="stage-card-winner-name">
                              {formatRiderName(s.winner)}
                            </span>
                          </div>
                        ) : (
                          <div className="stage-card-no-winner">TBC</div>
                        )}
                      </div>
                    </Link>
                  )
                })}
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
                      {r.rating && (
                        <span
                          style={{
                            fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: 14,
                            color: 'var(--gold)',
                          }}
                        >
                          {r.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="community-review-text">{r.review}</div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--muted)',
                        marginTop: 4,
                        letterSpacing: 0.5,
                      }}
                    >
                      View full review →
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <EditionComments slug={params.slug} year={year} />
        </div>

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <div className="rsp-sidebar">
          {/* Edition year navigation */}
          <div style={{ marginBottom: 24 }}>
            <div className="rsp-st">Edition</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Link
                href={nextYear ? `/races/${params.slug}/${nextYear}` : '#'}
                className="bs"
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  textDecoration: 'none',
                  opacity: nextYear ? 1 : 0.3,
                  pointerEvents: nextYear ? 'auto' : 'none',
                }}
              >
                ‹ {nextYear || ''}
              </Link>
              <span
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 22,
                  color: 'var(--gold)',
                }}
              >
                {year}
              </span>
              <Link
                href={prevYear ? `/races/${params.slug}/${prevYear}` : '#'}
                className="bs"
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  textDecoration: 'none',
                  opacity: prevYear ? 1 : 0.3,
                  pointerEvents: prevYear ? 'auto' : 'none',
                }}
              >
                {prevYear || ''} ›
              </Link>
            </div>
          </div>

          {/* Top 10 / Final GC */}
          {top10.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div className="rsp-st">{isStageRace ? 'Final GC' : 'Top 10'}</div>
              <div>
                {top10.slice(0, 10).map((name: string, i: number) => {
                  if (!name) return null
                  return (
                    <div key={i} className="top10-row">
                      <span className="t10-pos">{i + 1}</span>
                      <Link
                        href={`/riders/${encodeURIComponent(name)}`}
                        style={{
                          fontSize: 13,
                          flex: 1,
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        {formatRiderName(name)}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Avg rating */}
          {avgRating && (
            <div style={{ marginBottom: 24 }}>
              <div className="rsp-st">Avg Rating</div>
              <div
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 32,
                  color: 'var(--gold)',
                  lineHeight: 1,
                }}
              >
                {avgRating}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--muted)',
                  letterSpacing: 2,
                  marginTop: 2,
                }}
              >
                {reviews.length} rating{reviews.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Startlist */}
          <div>
            <EditionStartlist slug={params.slug} year={year} />
          </div>
        </div>
      </div>
    </div>
  )
}
