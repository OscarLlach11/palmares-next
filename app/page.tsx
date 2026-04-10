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
  const { data } = await supabase
    .from('races')
    .select('slug,race_name,race_type,first_year,last_year,tv_year,tier,country,flag,distance,gradient,swatch,description,subgenres,stage_count,logo_url')
    .order('race_name')
  return data || []
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
