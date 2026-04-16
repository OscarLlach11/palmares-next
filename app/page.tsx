import { supabase } from '@/lib/supabase'
import RaceGrid from './components/RaceGrid'
import DiscoverHero from './components/DiscoverHero'

export const revalidate = 600

const SG_LABELS: Record<string, string> = {
  cobbled: 'Cobbled', gravel: 'Gravel', mountain: 'Mountain', sprint: 'Sprinters',
  classics: 'Classics', ardennes: 'Ardennes', monument: 'Monument', gc: 'Grand Tour',
  'stage-race': 'Stage Race', tt: 'Time Trial',
}
const SG_CLASS: Record<string, string> = {
  cobbled: 'sg-cobbled', gravel: 'sg-gravel', mountain: 'sg-mountain', sprint: 'sg-sprint',
  classics: 'sg-classics', ardennes: 'sg-ardennes', monument: 'sg-classics', gc: 'sg-stage',
  'stage-race': 'sg-stage', tt: 'sg-tt',
}

async function getRaces() {
  const [racesRes, datesRes] = await Promise.all([
    supabase
      .from('races')
      .select('slug,race_name,race_type,first_year,last_year,tv_year,tier,country,flag,distance,gradient,swatch,description,subgenres,stage_count,logo_url'),
    supabase
      .from('race_dates')
      .select('race_id,year,race_date')
      .order('year', { ascending: false })
      .limit(5000),
  ])

  const races = racesRes.data || []
  const dateMap: Record<string, string> = {}
  const SORT_YEARS = [2025, 2024, 2026, 2023, 2022, 2021, 2020]
  ;(datesRes.data || []).forEach((d: any) => {
    const existing = dateMap[d.race_id]
    const mmdd = (d.race_date || '').slice(5)
    if (!mmdd) return
    if (!existing) { dateMap[d.race_id] = mmdd; return }
    const currentPriority = SORT_YEARS.indexOf(d.year)
    if (currentPriority !== -1 && currentPriority < SORT_YEARS.indexOf(parseInt(Object.entries(dateMap).find(([k]) => k === d.race_id)?.[0] || '0'))) {
      dateMap[d.race_id] = mmdd
    }
  })

  const isWT = (r: any) => r.tier === 'WT'
  const isChamp = (r: any) => (r.race_name || '').toLowerCase().includes('championships')

  return [...races].sort((a: any, b: any) => {
    if (isChamp(a) && !isChamp(b)) return 1
    if (!isChamp(a) && isChamp(b)) return -1
    const aWT = isWT(a) ? 0 : 1
    const bWT = isWT(b) ? 0 : 1
    if (aWT !== bWT) return aWT - bWT
    const mmddA = dateMap[a.slug] || ''
    const mmddB = dateMap[b.slug] || ''
    if (mmddA && mmddB) return mmddA.localeCompare(mmddB)
    if (mmddA) return -1
    if (mmddB) return 1
    return (a.tv_year || a.first_year || 9999) - (b.tv_year || b.first_year || 9999)
  })
}

async function getGlobalStats() {
  const [racesRes, logsRes] = await Promise.all([
    supabase.from('races').select('slug', { count: 'exact', head: true }),
    supabase.from('race_logs').select('id,rating'),
  ])
  const raceCount = racesRes.count || 0
  const logCount = logsRes.count || 0
  const ratingCount = (logsRes.data || []).filter((l: any) => l.rating > 0).length
  return { raceCount, logCount, ratingCount }
}

type FeaturedRider = {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

async function getFeaturedRiders(): Promise<FeaturedRider[]> {
  // 1. Load the list of names from app_config
  const { data: configRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'featured_riders')
    .maybeSingle()

  const entries: any[] = Array.isArray(configRow?.value) ? configRow.value : []
  if (!entries.length) return []

  const extractName = (e: any) => typeof e === 'object' ? (e?.name || '') : (e || '')
  const names: string[] = entries.map(extractName).filter(Boolean)
  if (!names.length) return []

  // 2. Single batch fetch: all rows matching any of the names.
  //    We fetch all years so we can pick the best image (any year) and
  //    the latest team name separately.
  //    Using .in() does a case-SENSITIVE exact match in Postgres, which is
  //    correct here because the names in app_config should exactly match
  //    the rider_name values in startlists (that's the contract).
  const { data: allRows } = await supabase
    .from('startlists')
    .select('rider_name,team_name,nationality,image_url,year')
    .in('rider_name', names)
    .order('year', { ascending: false })
    .limit(1000)

  // 3. Group all returned rows by their lowercase name for fast lookup
  const grouped = new Map<string, any[]>()
  for (const row of allRows || []) {
    const key = row.rider_name.toLowerCase()
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }

  // 4. For any name that returned zero rows, the name in app_config doesn't
  //    exactly match startlists.rider_name (different casing, extra space, etc).
  //    Fall back to a case-insensitive wildcard search for those names only.
  const unresolved = names.filter(n => !grouped.has(n.toLowerCase()))
  if (unresolved.length > 0) {
    // Run fallback lookups in parallel — one ilike per unresolved name
    const fallbackResults = await Promise.all(
      unresolved.map(name =>
        supabase
          .from('startlists')
          .select('rider_name,team_name,nationality,image_url,year')
          .ilike('rider_name', `%${name.trim()}%`)
          .order('year', { ascending: false })
          .limit(20)
      )
    )
    for (const res of fallbackResults) {
      for (const row of res.data || []) {
        const key = row.rider_name.toLowerCase()
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(row)
      }
    }
  }

  // 5. For each name in the original ordered list, pick the best image
  //    and the most recent team name from all rows for that rider.
  return names.map((name): FeaturedRider => {
    // Try exact key first, then case-insensitive search in grouped map
    const key = name.toLowerCase()
    let rows = grouped.get(key)

    // If exact key not found (because fallback added it under a different key),
    // find the best matching key in the grouped map
    if (!rows) {
      for (const [k, v] of grouped.entries()) {
        if (k.includes(key) || key.includes(k)) {
          rows = v
          break
        }
      }
    }

    if (!rows || !rows.length) {
      // Name genuinely not in DB — show a placeholder card
      return { rider_name: name, team_name: null, nationality: null, image_url: null }
    }

    // Best image: prefer rows with a non-null, non-'none' image_url, then pick most recent year
    const withImage = rows
      .filter(r => r.image_url && r.image_url !== 'none')
      .sort((a, b) => (b.year || 0) - (a.year || 0))

    // Latest row overall (for freshest team name)
    const latest = rows.reduce((a, b) => ((b.year || 0) > (a.year || 0) ? b : a), rows[0])
    const imageRow = withImage[0] || null

    return {
      rider_name: latest.rider_name,
      team_name: latest.team_name || null,
      nationality: latest.nationality || null,
      image_url: imageRow?.image_url || null,
    }
  })
}

export default async function DiscoverPage() {
  const [races, globalStats, featuredRiders] = await Promise.all([
    getRaces(),
    getGlobalStats(),
    getFeaturedRiders(),
  ])

  return (
    <>
      <DiscoverHero
        globalLogCount={globalStats.logCount}
        globalRatingCount={globalStats.ratingCount}
        raceCount={globalStats.raceCount}
      />
      <RaceGrid
        races={races as any}
        sgLabels={SG_LABELS}
        sgClass={SG_CLASS}
        featuredRiders={featuredRiders}
      />
    </>
  )
}
