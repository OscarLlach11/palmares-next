import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import EditionLink from './EditionLink'

export const revalidate = 3600

export async function generateStaticParams() {
  const { data } = await supabase.from('races').select('slug')
  return (data || []).map(r => ({ slug: r.slug }))
}

async function getRace(slug: string) {
  const { data } = await supabase.from('races').select('*').eq('slug', slug).single()
  return data
}

async function getEditionYears(slug: string): Promise<number[]> {
  const { data } = await supabase
    .from('race_results')
    .select('year')
    .eq('slug', slug)
    .order('year', { ascending: false })
  return (data || []).map(r => r.year)
}

async function getCommunityStats(slug: string) {
  const { data } = await supabase
    .from('race_logs')
    .select('rating')
    .eq('slug', slug)
    .not('rating', 'is', null)
    .gt('rating', 0)

  if (!data?.length) return null
  const avg = data.reduce((s, l) => s + l.rating, 0) / data.length
  return { avg: avg.toFixed(1), count: data.length }
}

export default async function RacePage({ params }: { params: { slug: string } }) {
  const [race, years, stats] = await Promise.all([
    getRace(params.slug),
    getEditionYears(params.slug),
    getCommunityStats(params.slug),
  ])

  if (!race) notFound()

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

  return (
    <div className="race-sub-layout">
      <div className="rsp-main">
        {/* Back */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/" className="bs" style={{ textDecoration: 'none', display: 'inline-block' }}>← Back</Link>
        </div>

        {/* Banner */}
        <div className="rsp-banner" style={{ background: race.gradient || '#1a1a1a' }}>
          {race.logo_url && (
            <img src={race.logo_url} alt={race.race_name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 20, opacity: 0.85 }}
            />
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="rsp-ttl">{race.race_name}</div>
            <span className="rsp-sub">{race.flag} {race.country}</span>
          </div>
        </div>

        {/* Info */}
        <div className="rsp-section">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
            <div><div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Type</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{race.race_type}</div></div>
            <div><div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Since</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{race.first_year}</div></div>
            {race.distance && <div><div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Distance</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14 }}>{race.distance} km</div></div>}
            {race.tier === 'WT' && <div><div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Tier</div>
              <div style={{ background: 'var(--gold)', color: '#000', fontSize: 9, padding: '2px 8px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>WorldTour</div></div>}
            {stats && <div><div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Community Rating</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--gold)' }}>{stats.avg} <span style={{ fontSize: 11, color: 'var(--muted)' }}>({stats.count})</span></div></div>}
          </div>
          {race.subgenres && race.subgenres.length > 0 && (
            <div>{race.subgenres.map((sg: string) => (
              <span key={sg} className={`sg-badge ${SG_CLASS[sg] || ''}`}>{SG_LABELS[sg] || sg}</span>
            ))}</div>
          )}
          {race.description && (
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.8, marginTop: 14 }}>{race.description}</p>
          )}
        </div>

        {/* Editions */}
        <div className="rsp-section">
          <div className="rsp-st">Editions</div>
          {years.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {years.map(year => (
                <EditionLink key={year} href={`/races/${race.slug}/${year}`} year={year} />
              ))}
            </div>
          ) : (
            <div className="empty">No edition data yet.</div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="rsp-sidebar">
        <div className="rsp-st">About</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
          {race.description || `${race.race_name} is a ${race.race_type.toLowerCase()} held in ${race.country}.`}
        </p>
        {years.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="rsp-st">Latest Edition</div>
            <Link href={`/races/${race.slug}/${years[0]}`} className="bp" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 8 }}>
              View {years[0]} Edition
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
