'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Names are now stored as "Firstname Lastname" — no transformation needed.
function formatRiderName(name: string): string {
  return name || ''
}

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface RiderInfo {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

interface RaceEntry {
  slug: string
  year: number
  position: number | null
  race_name: string
  gradient: string
  flag: string
  race_type: string
}

interface Trophy {
  slug: string
  year: number
  race_name: string
  gradient: string
  flag: string
  race_type: string
  isGC: boolean
  isStage: boolean
  stageNum?: number
}

export default function RiderPage() {
  const params = useParams()
  const riderName = decodeURIComponent(params.name as string)

  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<RiderInfo | null>(null)
  const [races, setRaces] = useState<RaceEntry[]>([])
  const [trophies, setTrophies] = useState<Trophy[]>([])
  const [tab, setTab] = useState<'races' | 'trophies'>('races')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    load()
  }, [riderName])

  async function load() {
    setLoading(true)

    // Get rider info from startlists — exact match first, then partial fallback
    const { data: slRows } = await supabase
      .from('startlists')
      .select('rider_name,team_name,nationality,image_url,year')
      .ilike('rider_name', riderName)
      .order('year', { ascending: false })
      .limit(50)

    if (!slRows?.length) {
      // Try partial match using the longest word in the name
      const parts = riderName.trim().split(' ')
      const longest = parts.reduce((a, b) => a.length >= b.length ? a : b)
      const { data: fallback } = await supabase
        .from('startlists')
        .select('rider_name,team_name,nationality,image_url,year')
        .ilike('rider_name', `%${longest}%`)
        .order('year', { ascending: false })
        .limit(10)
      if (!fallback?.length) { setNotFound(true); setLoading(false); return }
      const best = fallback[0]
      setInfo({
        rider_name: best.rider_name,
        team_name: best.team_name,
        nationality: best.nationality,
        image_url: best.image_url && best.image_url !== 'none' ? best.image_url : null,
      })
    } else {
      const best = slRows.find(r => r.image_url && r.image_url !== 'none') || slRows[0]
      const latest = slRows[0]
      setInfo({
        rider_name: best.rider_name,
        team_name: latest.team_name,
        nationality: latest.nationality,
        image_url: best.image_url && best.image_url !== 'none' ? best.image_url : null,
      })
    }

    // Use the canonical name from the DB for all subsequent queries
    const dbName = slRows?.[0]?.rider_name || riderName

    // Get GC wins from rider_wins
    const { data: wins } = await supabase
      .from('rider_wins')
      .select('race_slug,year')
      .eq('rider_name', dbName)
      .order('year', { ascending: false })

    // Get stage wins from stage_results
    const { data: stageWins } = await supabase
      .from('stage_results')
      .select('race_slug,year,stage_num,stage_label')
      .eq('winner', dbName)
      .order('year', { ascending: false })

    // Fetch race metadata for all involved slugs
    const slugs = [...new Set([
      ...(wins || []).map((w: any) => w.race_slug),
      ...(stageWins || []).map((s: any) => s.race_slug),
    ])]

    let raceMap: Record<string, any> = {}
    if (slugs.length) {
      const { data: raceData } = await supabase
        .from('races')
        .select('slug,race_name,gradient,flag,race_type')
        .in('slug', slugs)
      ;(raceData || []).forEach((r: any) => { raceMap[r.slug] = r })
    }

    // Build trophy list
    const trophyList: Trophy[] = [
      ...(wins || []).map((w: any) => ({
        slug: w.race_slug, year: w.year,
        race_name: raceMap[w.race_slug]?.race_name || w.race_slug,
        gradient: raceMap[w.race_slug]?.gradient || '#1a1a1a',
        flag: raceMap[w.race_slug]?.flag || '',
        race_type: raceMap[w.race_slug]?.race_type || '',
        isGC: true, isStage: false,
      })),
      ...(stageWins || []).map((s: any) => ({
        slug: s.race_slug, year: s.year,
        race_name: raceMap[s.race_slug]?.race_name || s.race_slug,
        gradient: raceMap[s.race_slug]?.gradient || '#1a1a1a',
        flag: raceMap[s.race_slug]?.flag || '',
        race_type: raceMap[s.race_slug]?.race_type || '',
        isGC: false, isStage: true,
        stageNum: s.stage_num,
      })),
    ].sort((a, b) => b.year - a.year)
    setTrophies(trophyList)

    // Get all race appearances from startlists
    const { data: appearances } = await supabase
      .from('startlists')
      .select('race_slug,year')
      .eq('rider_name', dbName)
      .order('year', { ascending: false })

    const appSlugs = [...new Set((appearances || []).map((a: any) => a.race_slug))]
    let appRaceMap: Record<string, any> = { ...raceMap }
    const missing = appSlugs.filter(s => !appRaceMap[s])
    if (missing.length) {
      const { data: moreRaces } = await supabase
        .from('races').select('slug,race_name,gradient,flag,race_type').in('slug', missing)
      ;(moreRaces || []).forEach((r: any) => { appRaceMap[r.slug] = r })
    }

    const raceList: RaceEntry[] = (appearances || []).map((a: any) => ({
      slug: a.race_slug, year: a.year,
      position: null,
      race_name: appRaceMap[a.race_slug]?.race_name || a.race_slug,
      gradient: appRaceMap[a.race_slug]?.gradient || '#1a1a1a',
      flag: appRaceMap[a.race_slug]?.flag || '',
      race_type: appRaceMap[a.race_slug]?.race_type || '',
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
  const gcWins = trophies.filter(t => t.isGC).length
  const stageWinCount = trophies.filter(t => t.isStage).length

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
                {displayName.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>}
        </div>
        <div>
          <div className="rider-page-name">{displayName}</div>
          <div className="rider-page-meta">
            {[info?.nationality, info?.team_name].filter(Boolean).join(' · ')}
          </div>
          <div className="rider-page-meta" style={{ marginTop: 6 }}>
            {races.length} race{races.length !== 1 ? 's' : ''} in database
            {gcWins > 0 && ` · ${gcWins} overall win${gcWins !== 1 ? 's' : ''}`}
            {stageWinCount > 0 && ` · ${stageWinCount} stage win${stageWinCount !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginTop: 28, marginBottom: 28 }}>
        {(['races', 'trophies'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--gold)' : 'transparent'}`, color: tab === t ? 'var(--gold)' : 'var(--muted)', padding: '10px 20px 10px 0', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2.5, cursor: 'pointer', transition: 'color .15s' }}>
            {t.toUpperCase()}
            {t === 'trophies' && trophies.length > 0 && (
              <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({trophies.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Races tab */}
      {tab === 'races' && (
        <div>
          {races.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>No race entries found.</div>
            : races.map((r, i) => (
              <Link key={`${r.slug}-${r.year}-${i}`} href={`/races/${r.slug}/${r.year}`}
                className="rider-race-row" style={{ textDecoration: 'none' }}>
                <div className="rider-race-swatch" style={{ background: r.gradient }} />
                <div style={{ flex: 1 }}>
                  <div className="rider-race-name">{r.race_name}</div>
                  <div className="rider-race-year">{r.flag} {r.year}</div>
                </div>
                {trophies.some(t => t.slug === r.slug && t.year === r.year && t.isGC) && (
                  <span style={{ fontSize: 12, color: 'var(--gold)' }}>🏆 Winner</span>
                )}
                {trophies.some(t => t.slug === r.slug && t.year === r.year && t.isStage) && (
                  <span style={{ fontSize: 12, color: 'var(--gold)' }}>⚡ Stage</span>
                )}
              </Link>
            ))
          }
        </div>
      )}

      {/* Trophies tab */}
      {tab === 'trophies' && (
        <div>
          {trophies.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>No wins recorded yet.</div>
            : (
              <>
                {gcWins > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: 'var(--gold)', marginBottom: 12 }}>
                      🏆 Overall Wins ({gcWins})
                    </div>
                    {trophies.filter(t => t.isGC).map((t, i) => (
                      <Link key={i} href={`/races/${t.slug}/${t.year}`}
                        className="rider-race-row" style={{ textDecoration: 'none' }}>
                        <div className="rider-race-swatch" style={{ background: t.gradient }} />
                        <div style={{ flex: 1 }}>
                          <div className="rider-race-name">{t.race_name}</div>
                          <div className="rider-race-year">{t.flag} {t.year}</div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--gold)' }}>🏆</span>
                      </Link>
                    ))}
                  </div>
                )}
                {stageWinCount > 0 && (
                  <div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: 'var(--gold)', marginBottom: 12 }}>
                      ⚡ Stage Wins ({stageWinCount})
                    </div>
                    {trophies.filter(t => t.isStage).map((t, i) => (
                      <Link key={i} href={`/races/${t.slug}/${t.year}/stages/${t.stageNum}`}
                        className="rider-race-row" style={{ textDecoration: 'none' }}>
                        <div className="rider-race-swatch" style={{ background: t.gradient }} />
                        <div style={{ flex: 1 }}>
                          <div className="rider-race-name">{t.race_name} — Stage {t.stageNum}</div>
                          <div className="rider-race-year">{t.flag} {t.year}</div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--gold)' }}>⚡</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )
          }
        </div>
      )}
    </div>
  )
}
