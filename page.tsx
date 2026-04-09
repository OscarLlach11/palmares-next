import { supabase, type Race } from '@/lib/supabase'
import RaceGrid from './components/RaceGrid'
import Link from 'next/link'

// Revalidate every 10 minutes
export const revalidate = 600

async function getRaces(): Promise<Race[]> {
  const { data, error } = await supabase
    .from('races')
    .select('slug, race_name, race_type, first_year, last_year, tv_year, tier, country, flag, distance, gradient, swatch, description, subgenres, stage_count, logo_url')
    .order('race_name')
  if (error) { console.error('getRaces error:', error); return [] }
  return data || []
}

async function getStats(): Promise<{ raceCount: number; logCount: number; ratingCount: number }> {
  const [racesRes, logsRes] = await Promise.all([
    supabase.from('races').select('slug', { count: 'exact', head: true }),
    supabase.from('race_logs').select('id, rating', { count: 'exact' }),
  ])
  const raceCount = racesRes.count || 0
  const logCount = logsRes.count || 0
  const ratingCount = (logsRes.data || []).filter(l => l.rating && l.rating > 0).length
  return { raceCount, logCount, ratingCount }
}

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

export default async function DiscoverPage() {
  const [races, stats] = await Promise.all([getRaces(), getStats()])

  const grandTours = races.filter(r => r.race_type === 'Grand Tour')
  const monuments = races.filter(r => r.race_type === 'Monument')
  const classics = races.filter(r => r.race_type === 'Classic')
  const stageRaces = races.filter(r => r.race_type === 'Stage Race')
  const oneDay = races.filter(r => r.race_type === 'One Day')
  const championships = races.filter(r => r.race_type === 'championship')

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <div className="hero-bg">VÉLO</div>
        <div className="eyebrow">— The Cycling Race Diary</div>
        <h1>Every <em>édition.</em> Logged.</h1>
        <p className="hero-sub">Rate stage by stage. Track every breakaway since 1980.</p>
        <div className="hstats">
          <div>
            <div className="hstat-n">{stats.logCount.toLocaleString()}</div>
            <div className="hstat-l">Races Logged</div>
          </div>
          <div>
            <div className="hstat-n">{stats.ratingCount.toLocaleString()}</div>
            <div className="hstat-l">Ratings Given</div>
          </div>
          <div>
            <div className="hstat-n">{stats.raceCount}</div>
            <div className="hstat-l">Races in DB</div>
          </div>
        </div>
      </div>

      {/* RACE GRID — client component for interactivity */}
      <RaceGrid
        races={races}
        grandTours={grandTours}
        monuments={monuments}
        classics={classics}
        stageRaces={stageRaces}
        oneDay={oneDay}
        championships={championships}
        sgLabels={SG_LABELS}
        sgClass={SG_CLASS}
      />
    </>
  )
}
