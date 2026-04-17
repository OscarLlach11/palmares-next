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
  const isChamp = (r: any) => r.race_type === 'championship'

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
  const { data: configRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'featured_riders')
    .maybeSingle()

  const entries: any[] = Array.isArray(configRow?.value) ? configRow.value : []
  if (!entries.length) return []

  const extractName = (e: any) => typeof e === 'object' ? (e?.name || '') : (e || '')
  const names: string[] = entries.map(extractName).filter(Boolean)

  // Single batch query: fetch ALL rows for ALL featured riders at once.
  // app_config now has canonical "Firstname Lastname" names matching startlists exactly.
  // This replaces 20 individual queries with 1 fast .in() query.
  const { data: allRows } = await supabase
    .from('startlists')
    .select('rider_name,team_name,nationality,image_url,year')
    .in('rider_name', names)
    .order('year', { ascending: false })

  if (!allRows?.length) return names.map(n => ({ rider_name: n, team_name: null, nationality: null, image_url: null }))

  // Group by rider, pick best image + latest team
  const bestByRider = new Map<string, any>()
  const latestByRider = new Map<string, any>()

  allRows.forEach((r: any) => {
    const key = r.rider_name
    if (!latestByRider.has(key) || r.year > latestByRider.get(key).year) {
      latestByRider.set(key, r)
    }
    const prev = bestByRider.get(key)
    const hasImg = r.image_url && r.image_url !== 'none'
    const prevHasImg = prev?.image_url && prev.image_url !== 'none'
    if (!prev || (hasImg && !prevHasImg) || (hasImg && prevHasImg && r.year > prev.year)) {
      bestByRider.set(key, r)
    }
  })

  return names.map(name => {
    const best = bestByRider.get(name)
    const latest = latestByRider.get(name)
    if (!best && !latest) {
      return { rider_name: name, team_name: null, nationality: null, image_url: null }
    }
    return {
      rider_name: name,
      team_name: latest?.team_name || null,
      nationality: latest?.nationality || best?.nationality || null,
      image_url: best?.image_url && best.image_url !== 'none' ? best.image_url : null,
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
