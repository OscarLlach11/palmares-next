'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import { formatRiderName, riderColor, riderInitials } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RiderInfo {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

interface Appearance {
  slug: string
  year: number
  team_name: string | null
}

interface GCWin {
  race_slug: string
  year: number
}

interface StageWin {
  race_slug: string
  year: number
  stage_num: number
  stage_label: string | null
}

interface RaceMeta {
  slug: string
  race_name: string
  gradient: string
  flag: string
  race_type: string
  tier: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Trophy cabinet types — mirrors the original index.html structure
// ─────────────────────────────────────────────────────────────────────────────

interface GCTrophy {
  slug: string
  raceName: string
  gradient: string
  category: string
  tier: string
  years: number[]
  isStage: false
}

interface StageTrophy {
  slug: string
  raceName: string
  gradient: string
  category: string
  tier: string
  wins: { year: number; stageLabel: string }[]
  isStage: true
}

type Trophy = GCTrophy | StageTrophy

const CAT_ORDER = ['Grand Tour', 'Monument', 'Classic', 'Stage Race', 'One Day', 'Pro']
const CAT_LABELS: Record<string, string> = {
  'Grand Tour': 'Grand Tours',
  'Monument': 'Monuments',
  'Classic': 'Classics',
  'Stage Race': 'Stage Races',
  'One Day': 'One-Day Races',
  'Pro': 'Pro Series',
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function RiderPage() {
  const params = useParams()
  const riderName = decodeURIComponent(params.name as string)
  const { logs } = useUser()  // for "WATCHED" badges on race rows

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [info, setInfo] = useState<RiderInfo | null>(null)
  const [appearances, setAppearances] = useState<Appearance[]>([])
  const [gcWins, setGcWins] = useState<GCWin[]>([])
  const [stageWins, setStageWins] = useState<StageWin[]>([])
  const [raceMetaMap, setRaceMetaMap] = useState<Record<string, RaceMeta>>({})
  const [tab, setTab] = useState<'races' | 'trophies'>('races')
  // Track which trophy rows are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => { load() }, [riderName])

  async function load() {
    setLoading(true)
    setNotFound(false)

    // ── 1. Rider info from startlists ────────────────────────────────────────
    let { data: slRows } = await supabase
      .from('startlists')
      .select('rider_name,team_name,nationality,image_url,year,slug')
      .ilike('rider_name', riderName)
      .order('year', { ascending: false })
      .limit(200)

    if (!slRows?.length) {
      // Partial match fallback
      const parts = riderName.trim().split(' ')
      const longest = parts.reduce((a, b) => a.length >= b.length ? a : b)
      const { data: fallback } = await supabase
        .from('startlists')
        .select('rider_name,team_name,nationality,image_url,year,slug')
        .ilike('rider_name', `%${longest}%`)
        .order('year', { ascending: false })
        .limit(20)
      if (!fallback?.length) { setNotFound(true); setLoading(false); return }
      slRows = fallback
    }

    // Pick best image (prefer non-null, most recent year) and latest team
    const withImg = [...slRows].filter(r => r.image_url && r.image_url !== 'none').sort((a, b) => (b.year || 0) - (a.year || 0))
    const latest = slRows[0]
    setInfo({
      rider_name: latest.rider_name,
      team_name: latest.team_name,
      nationality: latest.nationality,
      image_url: withImg[0]?.image_url || null,
    })

    const dbName = latest.rider_name

    // ── 2. Deduplicate appearances by slug+year ──────────────────────────────
    const seen = new Set<string>()
    const appList: Appearance[] = []
    for (const r of slRows) {
      const slugVal = r.slug || (r as any).race_slug
      if (!slugVal) continue
      const key = `${slugVal}|${r.year}`
      if (seen.has(key)) continue
      seen.add(key)
      appList.push({ slug: slugVal, year: r.year, team_name: r.team_name })
    }
    setAppearances(appList)

    // ── 3. Wins in parallel ──────────────────────────────────────────────────
    const [gcRes, stageRes] = await Promise.all([
      supabase.from('rider_wins').select('race_slug,year').ilike('rider_name', dbName).order('year', { ascending: false }),
      supabase.from('stage_results').select('race_slug,year,stage_num,stage_label').ilike('winner', dbName).order('year', { ascending: false }),
    ])
    const gcWinRows: GCWin[] = gcRes.data || []
    const stageWinRows: StageWin[] = stageRes.data || []
    setGcWins(gcWinRows)
    setStageWins(stageWinRows)

    // ── 4. Race metadata for all slugs involved ──────────────────────────────
    const allSlugs = [...new Set([
      ...appList.map(a => a.slug),
      ...gcWinRows.map(w => w.race_slug),
      ...stageWinRows.map(w => w.race_slug),
    ])]
    if (allSlugs.length) {
      const { data: raceData } = await supabase
        .from('races')
        .select('slug,race_name,gradient,flag,race_type,tier')
        .in('slug', allSlugs)
      const map: Record<string, RaceMeta> = {}
      ;(raceData || []).forEach((r: any) => { map[r.slug] = r })
      setRaceMetaMap(map)
    }

    setLoading(false)
  }

  // ─── Derived data ───────────────────────────────────────────────────────────

  // Set of "slug|year" for GC wins — for the 🏆 WIN badge on race rows
  const gcWinSet = new Set(gcWins.map(w => `${w.race_slug}|${w.year}`))

  // Set of "slug|year" for races the current user has logged — for WATCHED badge
  const watchedSet = new Set(
    Object.values(logs || {}).flatMap(entries =>
      (Array.isArray(entries) ? entries : []).map((e: any) => `${e.slug || ''}|${e.year}`)
    )
  )

  // Group appearances by year (descending), then sort races within year by slug
  const byYear: Record<number, Appearance[]> = {}
  for (const a of appearances) {
    if (!byYear[a.year]) byYear[a.year] = []
    byYear[a.year].push(a)
  }
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  // Build trophies grouped by category — mirrors index.html exactly
  const gcTrophyMap: Record<string, GCTrophy> = {}
  for (const w of gcWins) {
    const meta = raceMetaMap[w.race_slug]
    const cat = meta?.race_type || 'One Day'
    if (!gcTrophyMap[w.race_slug]) {
      gcTrophyMap[w.race_slug] = {
        slug: w.race_slug,
        raceName: meta?.race_name || w.race_slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        gradient: meta?.gradient || '#1a1a1a',
        category: cat,
        tier: meta?.tier || 'Pro',
        years: [],
        isStage: false,
      }
    }
    if (!gcTrophyMap[w.race_slug].years.includes(w.year)) {
      gcTrophyMap[w.race_slug].years.push(w.year)
    }
  }
  Object.values(gcTrophyMap).forEach(t => t.years.sort((a, b) => b - a))

  const stagesByRace: Record<string, { year: number; stageLabel: string }[]> = {}
  for (const w of stageWins) {
    if (!stagesByRace[w.race_slug]) stagesByRace[w.race_slug] = []
    stagesByRace[w.race_slug].push({ year: w.year, stageLabel: w.stage_label || String(w.stage_num) })
  }
  const stageTrophyMap: Record<string, StageTrophy> = {}
  for (const [raceSlug, wins] of Object.entries(stagesByRace)) {
    const meta = raceMetaMap[raceSlug]
    const cat = meta?.race_type || 'One Day'
    stageTrophyMap[raceSlug] = {
      slug: raceSlug,
      raceName: (meta?.race_name || raceSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) + ' – Stages',
      gradient: meta?.gradient || '#1a1a1a',
      category: cat,
      tier: meta?.tier || 'Pro',
      wins: wins.sort((a, b) => b.year - a.year || a.stageLabel.localeCompare(b.stageLabel, undefined, { numeric: true })),
      isStage: true,
    }
  }

  const allTrophies: Trophy[] = [...Object.values(gcTrophyMap), ...Object.values(stageTrophyMap)]
  const byCategory: Record<string, Trophy[]> = {}
  for (const t of allTrophies) {
    if (!byCategory[t.category]) byCategory[t.category] = []
    byCategory[t.category].push(t)
  }
  for (const arr of Object.values(byCategory)) {
    arr.sort((a, b) => {
      if (a.isStage !== b.isStage) return a.isStage ? 1 : -1
      const ac = a.isStage ? a.wins.length : a.years.length
      const bc = b.isStage ? b.wins.length : b.years.length
      return bc - ac || a.raceName.localeCompare(b.raceName)
    })
  }

  const totalGCWins = gcWins.length
  const totalStageWins = stageWins.length
  const trophyCount = allTrophies.length

  // ─── Early returns ──────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>
  if (notFound) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      Rider not found.
      <div style={{ marginTop: 12 }}>
        <Link href="/" className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back</Link>
      </div>
    </div>
  )

  const displayName = formatRiderName(info?.rider_name || riderName)
  const col = riderColor(info?.rider_name || riderName)
  const ini = riderInitials(info?.rider_name || riderName)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 48px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rider-page-header">
        <div style={{
          width: 100, aspectRatio: '2/3', flexShrink: 0,
          background: info?.image_url ? 'var(--card-bg)' : col,
          border: '1px solid var(--border)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {info?.image_url
            ? <img src={info.image_url} alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#fff' }}>{ini}</div>
          }
        </div>
        <div>
          <div className="rider-page-name">{displayName}</div>
          <div className="rider-page-meta">
            {[info?.nationality, info?.team_name].filter(Boolean).join(' · ')}
          </div>
          <div className="rider-page-meta" style={{ marginTop: 6 }}>
            {appearances.length} race{appearances.length !== 1 ? 's' : ''} in database
            {totalGCWins > 0 && ` · ${totalGCWins} win${totalGCWins !== 1 ? 's' : ''}`}
            {totalStageWins > 0 && ` · ${totalStageWins} stage win${totalStageWins !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginTop: 28, marginBottom: 28 }}>
        {(['races', 'trophies'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === t ? 'var(--gold)' : 'transparent'}`,
            color: tab === t ? 'var(--gold)' : 'var(--muted)',
            padding: '10px 20px 10px 0',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2.5,
            cursor: 'pointer', transition: 'color .15s',
          }}>
            {t === 'races' ? 'RACES' : (
              <>TROPHY CABINET{trophyCount > 0 && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({totalGCWins + totalStageWins})</span>}</>
            )}
          </button>
        ))}
      </div>

      {/* ── Races tab ──────────────────────────────────────────────────────── */}
      {tab === 'races' && (
        <div>
          {appearances.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>No race entries found.</div>
            : sortedYears.map(year => (
              <div key={year} style={{ marginBottom: 32 }}>
                {/* Year header */}
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3,
                  color: 'var(--gold)', borderBottom: '1px solid var(--border)',
                  paddingBottom: 8, marginBottom: 12,
                }}>
                  {year}
                </div>

                {byYear[year].map(entry => {
                  const meta = raceMetaMap[entry.slug]
                  const raceName = meta?.race_name || entry.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  const gradient = meta?.gradient || 'linear-gradient(135deg,#222,#333)'
                  const isGCWin = gcWinSet.has(`${entry.slug}|${year}`)
                  const isWatched = watchedSet.has(`${entry.slug}|${year}`)

                  return (
                    <Link
                      key={`${entry.slug}|${year}`}
                      href={`/races/${entry.slug}/${year}`}
                      className="rider-race-row"
                      style={{ textDecoration: 'none' }}
                    >
                      {/* Gradient swatch */}
                      <div style={{ width: 36, height: 36, flexShrink: 0, background: gradient }} />

                      {/* Race name + team */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="rider-race-name">{raceName}</div>
                        <div className="rider-race-year" style={{ marginTop: 2 }}>{entry.team_name || ''}</div>
                      </div>

                      {/* Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isGCWin && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: 'rgba(232,200,74,0.12)', border: '1px solid rgba(232,200,74,0.3)',
                            padding: '3px 8px',
                          }}>
                            <span style={{ fontSize: 10 }}>🏆</span>
                            <span style={{ fontSize: 9, color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5 }}>WIN</span>
                          </div>
                        )}
                        {isWatched && (
                          <div style={{
                            fontSize: 9, color: 'var(--muted)', border: '1px solid var(--border)',
                            padding: '3px 7px', letterSpacing: 1.5,
                            fontFamily: "'Bebas Neue', sans-serif",
                          }}>
                            WATCHED
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ))
          }
        </div>
      )}

      {/* ── Trophies tab ───────────────────────────────────────────────────── */}
      {tab === 'trophies' && (
        <div>
          {trophyCount === 0
            ? <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No recorded wins in the database.</div>
            : (
              <>
                {/* Summary bar */}
                <div style={{ display: 'flex', gap: 24, marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: 'var(--gold)' }}>{totalGCWins}</div>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)' }}>GC / Overall Wins</div>
                  </div>
                  {totalStageWins > 0 && (
                    <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#58a6ff' }}>{totalStageWins}</div>
                      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)' }}>Stage Wins</div>
                    </div>
                  )}
                </div>

                {/* Sections per category */}
                {CAT_ORDER.map(cat => {
                  const trophies = byCategory[cat]
                  if (!trophies?.length) return null
                  return (
                    <div key={cat} style={{ marginBottom: 36 }}>
                      <div style={{
                        fontSize: 9, letterSpacing: 3, textTransform: 'uppercase',
                        color: 'var(--muted)', marginBottom: 16, paddingBottom: 8,
                        borderBottom: '1px solid var(--border)',
                      }}>
                        {CAT_LABELS[cat] || cat}
                      </div>

                      {trophies.map(t => {
                        const count = t.isStage ? t.wins.length : t.years.length
                        const isGT = t.category === 'Grand Tour'
                        const isMonument = t.category === 'Monument'
                        const accentColor = isGT ? 'var(--gold)' : isMonument ? '#c8a87a' : '#58a6ff'
                        const rowKey = `${t.slug}-${t.isStage ? 'stage' : 'gc'}`
                        const isOpen = expanded[rowKey] || false

                        return (
                          <div key={rowKey} style={{ borderBottom: '1px solid var(--border)' }}>
                            {/* Header row */}
                            <div
                              onClick={() => setExpanded(prev => ({ ...prev, [rowKey]: !isOpen }))}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 0', cursor: 'pointer', transition: 'background .12s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <div style={{ width: 4, height: 36, flexShrink: 0, background: t.gradient, opacity: t.isStage ? 0.6 : 1 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: 'var(--fg)' }}>
                                  {t.raceName}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, color: accentColor }}>{count}</div>
                                <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--muted)' }}>
                                  {t.isStage ? `STAGE${count !== 1 ? 'S' : ''}` : `WIN${count !== 1 ? 'S' : ''}`}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--muted)', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</div>
                              </div>
                            </div>

                            {/* Expanded year/stage chips */}
                            {isOpen && (
                              <div style={{ padding: '0 0 12px 18px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {t.isStage
                                  ? t.wins.map((w, i) => (
                                    <Link
                                      key={i}
                                      href={`/races/${t.slug}/${w.year}/stages/${w.stageLabel}`}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '6px 12px', background: 'var(--card-bg)',
                                        border: '1px solid var(--border)', textDecoration: 'none',
                                        cursor: 'pointer', transition: 'border-color .15s',
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                                    >
                                      <span style={{ fontSize: 10 }}>🏆</span>
                                      <span style={{ fontSize: 11, color: '#58a6ff', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{w.year}</span>
                                      <span style={{ fontSize: 9, color: 'var(--muted)' }}>S.{w.stageLabel}</span>
                                    </Link>
                                  ))
                                  : t.years.map(y => (
                                    <Link
                                      key={y}
                                      href={`/races/${t.slug}/${y}`}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', background: 'var(--card-bg)',
                                        border: '1px solid var(--border)', textDecoration: 'none',
                                        cursor: 'pointer', transition: 'border-color .15s',
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.borderColor = `${accentColor}40`)}
                                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                                    >
                                      <span style={{ fontSize: 10 }}>🏆</span>
                                      <span style={{ fontSize: 12, color: accentColor, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{y}</span>
                                    </Link>
                                  ))
                                }
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )
          }
        </div>
      )}
    </div>
  )
}
