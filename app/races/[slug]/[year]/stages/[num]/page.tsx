import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 3600

async function getData(slug: string, year: number, stageNum: number) {
  const [raceRes, stageRes, allStagesRes] = await Promise.all([
    supabase.from('races').select('slug, race_name, gradient, logo_url, race_type').eq('slug', slug).single(),
    supabase.from('stage_results').select('*').eq('race_slug', slug).eq('year', year).eq('stage_num', stageNum).maybeSingle(),
    supabase.from('stage_results').select('stage_num, stage_label').eq('race_slug', slug).eq('year', year).order('stage_num'),
  ])
  return { race: raceRes.data, stage: stageRes.data, allStages: allStagesRes.data || [] }
}

function formatRiderName(name: string | null | undefined): string {
  if (!name) return ''
  return name.split(' ').map(w =>
    w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w
  ).join(' ')
}

export default async function StagePage({ params }: { params: { slug: string; year: string; num: string } }) {
  const year = parseInt(params.year)
  const stageNum = parseInt(params.num)
  const { race, stage, allStages } = await getData(params.slug, year, stageNum)

  if (!race) notFound()

  // Safely normalise array fields — some DB rows store these as objects or null
  const top10: string[] = Array.isArray(stage?.top10) ? stage.top10 : []
  const gcTop5: string[] = Array.isArray(stage?.gc_top5) ? stage.gc_top5 : []

  const prevStage = allStages.find(s => s.stage_num === stageNum - 1)
  const nextStage = allStages.find(s => s.stage_num === stageNum + 1)

  const label = stageNum === 0 ? 'Prologue' : `Stage ${stage?.stage_label || stageNum}`

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--bg)', padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href={`/races/${params.slug}/${year}`} className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back</Link>
        <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', flex: 1, textTransform: 'uppercase' }}>
          {race.race_name} {year}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {prevStage ? (
            <Link href={`/races/${params.slug}/${year}/stages/${prevStage.stage_num}`} className="bs" style={{ textDecoration: 'none', fontSize: 10, padding: '4px 10px' }}>‹</Link>
          ) : <span style={{ width: 32 }} />}
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--gold)' }}>{label}</span>
          {nextStage ? (
            <Link href={`/races/${params.slug}/${year}/stages/${nextStage.stage_num}`} className="bs" style={{ textDecoration: 'none', fontSize: 10, padding: '4px 10px' }}>›</Link>
          ) : <span style={{ width: 32 }} />}
        </div>
      </div>

      <div className="race-sub-layout">
        <div className="rsp-main">
          {/* Banner */}
          <div className="rsp-banner" style={{ background: race.gradient || '#1a1a1a' }}>
            {race.logo_url && (
              <img src={race.logo_url} alt={race.race_name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 20, opacity: 0.6 }} />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="rsp-ttl">{label}</div>
              <span className="rsp-sub">{race.race_name} · {year}</span>
            </div>
          </div>

          {stage ? (
            <>
              {/* Stage info */}
              <div className="rsp-section">
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {stage.departure && stage.arrival && (
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Route</div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{stage.departure} → {stage.arrival}</div>
                    </div>
                  )}
                  {stage.distance_km && (
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Distance</div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{stage.distance_km} km</div>
                    </div>
                  )}
                  {stage.stage_type && (
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Type</div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14, textTransform: 'capitalize' }}>{stage.stage_type}</div>
                    </div>
                  )}
                  {stage.avg_speed && (
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Avg Speed</div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{stage.avg_speed} km/h</div>
                    </div>
                  )}
                  {stage.stage_date && (
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Date</div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>
                        {new Date(stage.stage_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Winner */}
              {stage.winner && (
                <div className="rsp-section">
                  <div className="rsp-st">Stage Winner</div>
                  <Link href={`/riders/${encodeURIComponent(stage.winner)}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--gold)', marginBottom: 4 }}>
                      {formatRiderName(stage.winner)}
                    </div>
                    {stage.winner_team && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{stage.winner_team}</div>
                    )}
                  </Link>
                </div>
              )}

              {/* GC after stage */}
              {gcTop5.length > 0 && (
                <div className="rsp-section">
                  <div className="rsp-st">GC After Stage</div>
                  {gcTop5.slice(0, 5).map((entry: any, i: number) => {
                    const name = typeof entry === 'string' ? entry : (entry?.rider || entry?.rider_name || '')
                    const time = typeof entry === 'object' ? (entry?.time || entry?.gap || '') : ''
                    if (!name) return null
                    return (
                      <div key={i} className="top10-row">
                        <span className="t10-pos">{i + 1}</span>
                        <Link href={`/riders/${encodeURIComponent(name)}`} style={{ fontSize: 13, flex: 1, textDecoration: 'none', color: 'inherit' }}>
                          {formatRiderName(name)}
                        </Link>
                        {time && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{time}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Prev / Next nav */}
              <div style={{ display: 'flex', gap: 8, padding: '0 0 24px' }}>
                {prevStage && (
                  <Link href={`/races/${params.slug}/${year}/stages/${prevStage.stage_num}`} className="bs"
                    style={{ flex: 1, textAlign: 'left', textDecoration: 'none', display: 'block', padding: '10px 16px' }}>
                    ‹ {prevStage.stage_num === 0 ? 'Prologue' : `Stage ${prevStage.stage_label || prevStage.stage_num}`}
                  </Link>
                )}
                {nextStage && (
                  <Link href={`/races/${params.slug}/${year}/stages/${nextStage.stage_num}`} className="bs"
                    style={{ flex: 1, textAlign: 'right', textDecoration: 'none', display: 'block', padding: '10px 16px' }}>
                    Stage {nextStage.stage_label || nextStage.stage_num} ›
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="empty">No data available for this stage.</div>
          )}
        </div>

        {/* Sidebar */}
        <div className="rsp-sidebar">
          {top10.length > 0 && (
            <>
              <div className="rsp-st">Top 10</div>
              <div style={{ marginBottom: 24 }}>
                {top10.slice(0, 10).map((entry: any, i: number) => {
                  const name = typeof entry === 'string' ? entry : (entry?.rider || entry?.rider_name || '')
                  const gap = typeof entry === 'object' ? (entry?.gap || entry?.time || '') : ''
                  if (!name) return null
                  return (
                    <div key={i} className="top10-row">
                      <span className="t10-pos">{i + 1}</span>
                      <Link href={`/riders/${encodeURIComponent(name)}`} style={{ fontSize: 13, flex: 1, textDecoration: 'none', color: 'inherit' }}>
                        {formatRiderName(name)}
                      </Link>
                      {gap && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{gap}</span>}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Stage winner callout in sidebar */}
          {stage?.winner && top10.length === 0 && (
            <>
              <div className="rsp-st">Stage Winner</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, marginBottom: 4, color: 'var(--gold)' }}>
                {formatRiderName(stage.winner)}
              </div>
              {stage.winner_team && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 20 }}>{stage.winner_team}</div>
              )}
            </>
          )}

          {/* All stages nav */}
          {allStages.length > 0 && (
            <div style={{ marginTop: top10.length > 0 ? 0 : 0 }}>
              <div className="rsp-st">All Stages</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {allStages.map(s => (
                  <Link key={s.stage_num} href={`/races/${params.slug}/${year}/stages/${s.stage_num}`}
                    style={{
                      padding: '6px 10px', fontSize: 11, textDecoration: 'none',
                      background: s.stage_num === stageNum ? 'rgba(232,200,74,.1)' : 'transparent',
                      color: s.stage_num === stageNum ? 'var(--gold)' : 'var(--muted)',
                      borderLeft: s.stage_num === stageNum ? '2px solid var(--gold)' : '2px solid transparent',
                      transition: 'all .15s',
                    }}>
                    {s.stage_num === 0 ? 'P' : s.stage_num}. {s.stage_label || `Stage ${s.stage_num}`}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
