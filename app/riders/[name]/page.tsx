'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

function formatRiderName(name: string): string {
  return name || ''
}

interface RiderInfo {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

interface RaceAppearance {
  slug: string
  year: number
  race_name: string
  gradient: string
  flag: string
  race_type: string
  team_name: string | null
  race_date: string | null
}

interface GCTrophy {
  slug: string
  race_name: string
  gradient: string
  flag: string
  category: string
  years: number[]
  isStage: false
}

interface StageTrophy {
  slug: string
  race_name: string
  gradient: string
  flag: string
  category: string
  wins: { year: number; stageNum: number; stageLabel: string }[]
  isStage: true
}

type Trophy = GCTrophy | StageTrophy

const CAT_ORDER = ['Grand Tour', 'Monument', 'Classic', 'Stage Race', 'One Day', 'Pro', 'championship']
const CAT_LABELS: Record<string, string> = {
  'Grand Tour': 'Grand Tours',
  'Monument': 'Monuments',
  'Classic': 'Classics',
  'Stage Race': 'Stage Races',
  'One Day': 'One-Day Races',
  'Pro': 'Pro Series',
  'championship': 'Championships',
}

export default function RiderPage() {
  const params = useParams()
  const riderName = decodeURIComponent(params.name as string)
  const { logs } = useUser()

  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<RiderInfo | null>(null)
  const [races, setRaces] = useState<RaceAppearance[]>([])
  const [trophies, setTrophies] = useState<Trophy[]>([])
  const [tab, setTab] = useState<'races' | 'trophies'>('races')
  const [notFound, setNotFound] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => { load() }, [riderName])

  function toggleRow(key: string) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Check if the user has logged a specific race+year
  function getUserWatch(slug: string, year: number) {
    const raceLogs = logs[slug]
    if (!raceLogs) return null
    return (raceLogs as any[]).find((l: any) => l.year === year) || null
  }

  async function load() {
    setLoading(true)

    // ── Find the rider in startlists ──────────────────────────────────────
    let slRows: any[] | null = null

    // Attempt 1: exact match
    const { data: exactRows } = await supabase
      .from('startlists')
      .select('rider_name,team_name,nationality,image_url,year')
      .ilike('rider_name', riderName)
      .order('year', { ascending: false })
      .limit(50)

    if (exactRows?.length) {
      slRows = exactRows
    } else {
      // Attempt 2: multi-word AND search
      const words = riderName.trim().split(/\s+/).filter(w => w.length >= 2)
      if (words.length >= 1) {
        let query = supabase
          .from('startlists')
          .select('rider_name,team_name,nationality,image_url,year')
        for (const word of words) {
          query = query.ilike('rider_name', `%${word}%`)
        }
        const { data: wordRows } = await query.order('year', { ascending: false }).limit(50)
        if (wordRows?.length) slRows = wordRows
      }

      // Attempt 3: longest word fallback
      if (!slRows?.length) {
        const parts = riderName.trim().split(/\s+/)
        const longest = parts.reduce((a, b) => a.length >= b.length ? a : b)
        const { data: fallbackRows } = await supabase
          .from('startlists')
          .select('rider_name,team_name,nationality,image_url,year')
          .ilike('rider_name', `%${longest}%`)
          .order('year', { ascending: false })
          .limit(10)
        if (fallbackRows?.length) slRows = fallbackRows
      }
    }

    if (!slRows?.length) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const best = slRows.find(r => r.image_url && r.image_url !== 'none') || slRows[0]
    const latest = slRows[0]
    const dbName = latest.rider_name

    setInfo({
      rider_name: best.rider_name,
      team_name: latest.team_name,
      nationality: latest.nationality,
      image_url: best.image_url && best.image_url !== 'none' ? best.image_url : null,
    })

    // ── Fetch everything in parallel ─────────────────────────────────────
    // Note: startlists column is "slug", not "race_slug"
    const [winsRes, stageWinsRes, appearancesRes] = await Promise.all([
      supabase.from('rider_wins').select('race_slug,year').eq('rider_name', dbName).order('year', { ascending: false }),
      supabase.from('stage_results').select('race_slug,year,stage_num,stage_label').eq('winner', dbName).order('year', { ascending: false }),
      supabase.from('startlists').select('slug,year,team_name').eq('rider_name', dbName).order('year', { ascending: false }),
    ])

    const wins = winsRes.data || []
    const stageWins = stageWinsRes.data || []
    const appearances = appearancesRes.data || []

    // Collect all slugs (startlists uses "slug", others use "race_slug")
    const allSlugs = [...new Set([
      ...wins.map((w: any) => w.race_slug),
      ...stageWins.map((s: any) => s.race_slug),
      ...appearances.map((a: any) => a.slug),
    ])]

    // Fetch race metadata + race_dates in parallel
    let raceMap: Record<string, any> = {}
    let dateMap: Record<string, Record<number, string>> = {}

    if (allSlugs.length) {
      const [raceDataRes, raceDatesRes] = await Promise.all([
        supabase.from('races').select('slug,race_name,gradient,flag,race_type,tier').in('slug', allSlugs),
        supabase.from('race_dates').select('race_id,year,race_date').in('race_id', allSlugs),
      ])
      ;(raceDataRes.data || []).forEach((r: any) => { raceMap[r.slug] = r })
      ;(raceDatesRes.data || []).forEach((d: any) => {
        if (!dateMap[d.race_id]) dateMap[d.race_id] = {}
        dateMap[d.race_id][d.year] = d.race_date
      })
    }

    // ── Build trophy cabinet ─────────────────────────────────────────────
    const gcMap: Record<string, GCTrophy> = {}
    wins.forEach((w: any) => {
      const race = raceMap[w.race_slug]
      if (!gcMap[w.race_slug]) {
        gcMap[w.race_slug] = {
          slug: w.race_slug,
          race_name: race?.race_name || w.race_slug,
          gradient: race?.gradient || '#1a1a1a',
          flag: race?.flag || '',
          category: race?.race_type || 'One Day',
          years: [],
          isStage: false,
        }
      }
      const yr = parseInt(w.year)
      if (!gcMap[w.race_slug].years.includes(yr)) gcMap[w.race_slug].years.push(yr)
    })
    Object.values(gcMap).forEach(t => t.years.sort((a, b) => b - a))

    const stageMap: Record<string, StageTrophy> = {}
    stageWins.forEach((s: any) => {
      const race = raceMap[s.race_slug]
      if (!stageMap[s.race_slug]) {
        stageMap[s.race_slug] = {
          slug: s.race_slug,
          race_name: (race?.race_name || s.race_slug) + ' – Stages',
          gradient: race?.gradient || '#1a1a1a',
          flag: race?.flag || '',
          category: race?.race_type || 'One Day',
          wins: [],
          isStage: true,
        }
      }
      stageMap[s.race_slug].wins.push({
        year: parseInt(s.year),
        stageNum: s.stage_num,
        stageLabel: s.stage_label || String(s.stage_num),
      })
    })
    Object.values(stageMap).forEach(t =>
      t.wins.sort((a, b) => b.year - a.year || String(a.stageLabel).localeCompare(String(b.stageLabel), undefined, { numeric: true }))
    )

    setTrophies([...Object.values(gcMap), ...Object.values(stageMap)])

    // ── Build race appearances with date info ────────────────────────────
    const raceList: RaceAppearance[] = appearances.map((a: any) => ({
      slug: a.slug,
      year: a.year,
      race_name: raceMap[a.slug]?.race_name || a.slug,
      gradient: raceMap[a.slug]?.gradient || '#1a1a1a',
      flag: raceMap[a.slug]?.flag || '',
      race_type: raceMap[a.slug]?.race_type || '',
      team_name: a.team_name || null,
      race_date: dateMap[a.slug]?.[a.year] || null,
    }))
    setRaces(raceList)
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>
  if (notFound) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      Rider not found.
      <div style={{ marginTop: 12 }}><Link href="/" className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back</Link></div>
    </div>
  )

  const displayName = formatRiderName(info?.rider_name || riderName)
  const gcTrophies = trophies.filter((t): t is GCTrophy => !t.isStage)
  const stageTrophies = trophies.filter((t): t is StageTrophy => t.isStage)
  const totalGCWins = gcTrophies.reduce((s, t) => s + t.years.length, 0)
  const totalStageWins = stageTrophies.reduce((s, t) => s + t.wins.length, 0)

  // GC win lookup set for badges: "slug|year"
  const gcWinSet = new Set(gcTrophies.flatMap(t => t.years.map(y => `${t.slug}|${y}`)))
  // Stage win lookup set: "slug|year"
  const stageWinYearSet = new Set(stageTrophies.flatMap(t => t.wins.map(w => `${t.slug}|${w.year}`)))

  // Group races by year, sort by date within each year
  const byYear: Record<number, RaceAppearance[]> = {}
  races.forEach(r => {
    if (!byYear[r.year]) byYear[r.year] = []
    byYear[r.year].push(r)
  })
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => b - a)
  // Sort within each year by race_date, then alphabetically
  sortedYears.forEach(year => {
    byYear[year].sort((a, b) => {
      if (a.race_date && b.race_date) return a.race_date.localeCompare(b.race_date)
      if (a.race_date) return -1
      if (b.race_date) return 1
      return a.race_name.localeCompare(b.race_name)
    })
  })

  // Deduplicate: count unique slug+year combos
  const totalRaces = new Set(races.map(r => `${r.slug}|${r.year}`)).size

  // Group trophies by category
  const byCategory: Record<string, Trophy[]> = {}
  trophies.forEach(t => {
    const cat = t.category
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(t)
  })
  Object.values(byCategory).forEach(arr => {
    arr.sort((a, b) => {
      if (a.isStage !== b.isStage) return a.isStage ? 1 : -1
      const aCount = a.isStage ? (a as StageTrophy).wins.length : (a as GCTrophy).years.length
      const bCount = b.isStage ? (b as StageTrophy).wins.length : (b as GCTrophy).years.length
      return bCount - aCount || a.race_name.localeCompare(b.race_name)
    })
  })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 48px' }}>
      {/* Header */}
      <div className="rider-page-header">
        <div style={{ width: 100, aspectRatio: '2/3', flexShrink: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {info?.image_url
            ? <img src={info.image_url} alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--muted)' }}>
                {displayName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('')}
              </div>}
        </div>
        <div>
          <div className="rider-page-name">{displayName}</div>
          <div className="rider-page-meta">{[info?.nationality, info?.team_name].filter(Boolean).join(' · ')}</div>
          <div className="rider-page-meta" style={{ marginTop: 6 }}>
            {totalRaces} race{totalRaces !== 1 ? 's' : ''} in database
            {totalGCWins > 0 && ` · ${totalGCWins} win${totalGCWins !== 1 ? 's' : ''}`}
            {totalStageWins > 0 && ` · ${totalStageWins} stage win${totalStageWins !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginTop: 28, marginBottom: 28 }}>
        {(['races', 'trophies'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--gold)' : 'transparent'}`, color: tab === t ? 'var(--gold)' : 'var(--muted)', padding: '10px 20px 10px 0', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2.5, cursor: 'pointer', transition: 'color .15s' }}>
            {t.toUpperCase()}
            {t === 'trophies' && (totalGCWins + totalStageWins) > 0 && (
              <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({totalGCWins + totalStageWins})</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ Races tab — grouped by year, date-sorted ══ */}
      {tab === 'races' && (
        <div>
          {totalRaces === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>No logged races found for this rider.</div>
            : sortedYears.map(year => (
              <div key={year} style={{ marginBottom: 32 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: 'var(--gold)', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                  {year}
                </div>
                {byYear[year].map((r, i) => {
                  const isGCWin = gcWinSet.has(`${r.slug}|${r.year}`)
                  const hasStageWin = stageWinYearSet.has(`${r.slug}|${r.year}`)
                  const watch = getUserWatch(r.slug, r.year)

                  return (
                    <Link key={`${r.slug}-${r.year}-${i}`} href={`/races/${r.slug}/${r.year}`}
                      style={{ padding: '13px 0', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)', cursor: 'pointer', textDecoration: 'none', transition: 'background .12s' }}>
                      <div style={{ width: 36, height: 36, flexShrink: 0, background: r.gradient }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: 'var(--white)' }}>{r.race_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{r.team_name || ''}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isGCWin && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(232,200,74,0.12)', border: '1px solid rgba(232,200,74,0.3)', padding: '3px 8px' }}>
                            <span style={{ fontSize: 10 }}>🏆</span>
                            <span style={{ fontSize: 9, color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5 }}>WIN</span>
                          </div>
                        )}
                        {hasStageWin && !isGCWin && (
                          <span style={{ fontSize: 12, color: 'var(--gold)' }}>⚡</span>
                        )}
                        {watch?.rating && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(232,200,74,0.08)', border: '1px solid rgba(232,200,74,0.2)', padding: '3px 8px' }}>
                            <span style={{ color: 'var(--gold)', fontSize: 11 }}>★</span>
                            <span style={{ color: 'var(--gold)', fontSize: 12, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{watch.rating}</span>
                          </div>
                        )}
                        {watch && (
                          <div style={{ fontSize: 9, color: 'var(--muted)', border: '1px solid var(--border)', padding: '3px 7px', letterSpacing: 1.5, fontFamily: "'Bebas Neue', sans-serif" }}>WATCHED</div>
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

      {/* ══ Trophies tab — grouped by category, collapsible ══ */}
      {tab === 'trophies' && (
        <div>
          {trophies.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No recorded wins in the database.
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: 'var(--gold)' }}>{totalGCWins}</div>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)' }}>GC / Overall Wins</div>
                </div>
                {totalStageWins > 0 && (
                  <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: 'var(--ml)' }}>{totalStageWins}</div>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)' }}>Stage Wins</div>
                  </div>
                )}
              </div>

              {/* Sections by category */}
              {CAT_ORDER.filter(cat => byCategory[cat]?.length).map(cat => (
                <div key={cat} style={{ marginBottom: 36 }}>
                  <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    {CAT_LABELS[cat] || cat}
                  </div>
                  <div>
                    {byCategory[cat].map(t => {
                      const count = t.isStage ? (t as StageTrophy).wins.length : (t as GCTrophy).years.length
                      const isGT = t.category === 'Grand Tour'
                      const isMonument = t.category === 'Monument'
                      const accentColor = isGT ? 'var(--gold)' : isMonument ? '#c8a87a' : 'var(--ml)'
                      const rowKey = t.slug + (t.isStage ? '-stage' : '-gc')
                      const expanded = expandedRows.has(rowKey)

                      return (
                        <div key={rowKey} style={{ borderBottom: '1px solid var(--border)' }}>
                          <div
                            onClick={() => toggleRow(rowKey)}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', cursor: 'pointer', transition: 'background .12s' }}
                          >
                            <div style={{ width: 4, height: 36, flexShrink: 0, background: t.gradient, opacity: t.isStage ? 0.6 : 1 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: 'var(--white)' }}>
                                {t.race_name}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, color: accentColor }}>{count}</div>
                              <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--muted)' }}>
                                {t.isStage ? `STAGE${count !== 1 ? 'S' : ''}` : `WIN${count !== 1 ? 'S' : ''}`}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--muted)', transition: 'transform .2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</div>
                            </div>
                          </div>

                          {expanded && (
                            <div style={{ padding: '0 0 12px 18px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {t.isStage
                                ? (t as StageTrophy).wins.map((w, i) => (
                                  <Link key={i} href={`/races/${t.slug}/${w.year}/stages/${w.stageNum}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--card-bg)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'border-color .15s' }}>
                                    <span style={{ fontSize: 10 }}>🏆</span>
                                    <span style={{ fontSize: 11, color: 'var(--ml)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{w.year}</span>
                                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>S.{w.stageLabel}</span>
                                  </Link>
                                ))
                                : (t as GCTrophy).years.map((y, i) => (
                                  <Link key={i} href={`/races/${t.slug}/${y}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--card-bg)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'border-color .15s' }}>
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
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
