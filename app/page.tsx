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

  // Build a date map: race_id -> best MM-DD for calendar sorting
  const dateMap: Record<string, string> = {}
  const SORT_YEARS = [2025, 2024, 2026, 2023, 2022, 2021, 2020]
  ;(datesRes.data || []).forEach((d: any) => {
    const existing = dateMap[d.race_id]
    const mmdd = (d.race_date || '').slice(5) // "MM-DD"
    if (!mmdd) return
    if (!existing) { dateMap[d.race_id] = mmdd; return }
    // Prefer a recent stable year
    const existingYear = parseInt(Object.entries(dateMap).find(([k]) => k === d.race_id)?.[0] || '0')
    const currentPriority = SORT_YEARS.indexOf(d.year)
    if (currentPriority !== -1 && currentPriority < SORT_YEARS.indexOf(existingYear)) {
      dateMap[d.race_id] = mmdd
    }
  })

  // Sort: WT first, then by MM-DD calendar position, then by first_year
  const isWT = (r: any) => r.tier === 'WT'
  const isChamp = (r: any) => r.race_type === 'championship'

  return [...races].sort((a: any, b: any) => {
    // Championships always last
    if (isChamp(a) && !isChamp(b)) return 1
    if (!isChamp(a) && isChamp(b)) return -1
    // WT before non-WT
    const aWT = isWT(a) ? 0 : 1
    const bWT = isWT(b) ? 0 : 1
    if (aWT !== bWT) return aWT - bWT
    // Within same tier, sort by calendar MM-DD
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

export default async function DiscoverPage() {
  const [races, globalStats] = await Promise.all([getRaces(), getGlobalStats()])

  return (
    <>
      <DiscoverHero
        globalLogCount={globalStats.logCount}
        globalRatingCount={globalStats.ratingCount}
        raceCount={globalStats.raceCount}
      />
      <RaceGrid races={races as any} sgLabels={SG_LABELS} sgClass={SG_CLASS} />
    </>
  )
}
