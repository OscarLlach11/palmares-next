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

  const results = await Promise.all(
    names.map(async (name): Promise<FeaturedRider> => {
      // Use %name% wildcards so we match regardless of whether app_config
      // has old-format names (e.g. "POGAČAR Tadej") or new-format names
      // (e.g. "Tadej Pogačar"). The DB is now canonical "Firstname Lastname"
      // but app_config may lag behind until manually updated.
      const [withImageRes, latestRes] = await Promise.all([
        supabase
          .from('startlists')
          .select('rider_name,team_name,nationality,image_url,year')
          .ilike('rider_name', `%${name}%`)
          .not('image_url', 'is', null)
          .neq('image_url', 'none')
          .order('year', { ascending: false })
          .limit(1),
        supabase
          .from('startlists')
          .select('rider_name,team_name,nationality,year')
          .ilike('rider_name', `%${name}%`)
          .order('year', { ascending: false })
          .limit(1),
      ])

      const imageRow = withImageRes.data?.[0] || null
      const latestRow = latestRes.data?.[0] || null

      if (!latestRow && !imageRow) {
        return { rider_name: name, team_name: null, nationality: null, image_url: null }
      }

      return {
        rider_name: latestRow?.rider_name || imageRow?.rider_name || name,
        team_name: latestRow?.team_name || null,
        nationality: latestRow?.nationality || imageRow?.nationality || null,
        image_url: imageRow?.image_url || null,
      }
    })
  )

  return results
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
