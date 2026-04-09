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

function formatRiderName(name: string): string {
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

  const prevStage = allStages.find(s => s.stage_num === stageNum - 1)
  const nextStage = allStages.find(s => s.stage_num === stageNum + 1)

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--black)', padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href={`/races/${params.slug}/${year}`} className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back</Link>
        <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', flex: 1, textTransform: 'uppercase' }}>
          {race.race_name} {year}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {prevStage && (
            <Link href={`/races/${params.slug}/${year}/stages/${prevStage.stage_num}`} className="bs" style={{ textDecoration: 'none', fontSize: 10, padding: '4px 10px' }}>‹</Link>
          )}
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--gold)' }}>Stage {stageNum}</span>
          {nextStage && (
            <Link href={`/races/${params.slug}/${year}/stages/${nextStage.stage_num}`} className="bs" style={{ textDecoration: 'none', fontSize: 10, padding: '4px 10px' }}>›</Link>
          )}
        </div>
      </div>

      <div className="race-sub-layout">
        <div className="rsp-main">
          {/* Stage header */}
          <div className="rsp-banner" style={{ background: race.gradient || '#1a1a1a' }}>
            {race.logo_url && <img src={race.logo_url} alt={race.race_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 20, opacity: 0.6 }} />}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="rsp-ttl">Stage {stageNum}</div>
              <span className="rsp-sub">{stage?.stage_label || `${race.race_name} ${year}`}</span>
            </div>
          </div>

          {stage ? (
            <>
              {/* Stage info strip */}
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
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{stage.stage_type}</div>
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
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{stage.stage_date}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stage winner */}
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
              {stage.gc_top5 && stage.gc_top5.length > 0 && (
                <div className="rsp-section">
                  <div className="rsp-st">GC After Stage</div>
                  {stage.gc_top5.slice(0, 5).map((name: string, i: number) => (
                    <div key={i} className="top10-row">
                      <span className="t10-pos">{i + 1}</span>
                      <Link href={`/riders/${encodeURIComponent(name)}`} style={{ fontSize: 13, flex: 1, textDecoration: 'none', color: 'inherit' }}>
                        {formatRiderName(name)}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty">No data available for this stage.</div>
          )}
        </div>

        {/* Sidebar: Top 10 */}
        <div className="rsp-sidebar">
          {stage?.top10 && stage.top10.length > 0 && (
            <>
              <div className="rsp-st">Top 10</div>
              {stage.top10.slice(0, 10).map((name: string, i: number) => (
                <div key={i} className="top10-row">
                  <span className="t10-pos">{i + 1}</span>
                  <Link href={`/riders/${encodeURIComponent(name)}`} style={{ fontSize: 13, flex: 1, textDecoration: 'none', color: 'inherit' }}>
                    {formatRiderName(name)}
                  </Link>
                </div>
              ))}
            </>
          )}

          {/* Stage nav */}
          {allStages.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="rsp-st">All Stages</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {allStages.map(s => (
                  <Link key={s.stage_num} href={`/races/${params.slug}/${year}/stages/${s.stage_num}`}
                    style={{ padding: '6px 10px', fontSize: 11, textDecoration: 'none', background: s.stage_num === stageNum ? 'rgba(232,200,74,.1)' : 'transparent', color: s.stage_num === stageNum ? 'var(--gold)' : 'var(--muted)', borderLeft: s.stage_num === stageNum ? '2px solid var(--gold)' : '2px solid transparent', transition: 'all .15s' }}>
                    {s.stage_num}. {s.stage_label || `Stage ${s.stage_num}`}
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
