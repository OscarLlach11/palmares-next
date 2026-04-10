'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Race } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import LogRaceModal from './LogRaceModal'
import { supabase } from '@/lib/supabase'

interface Props {
  races: Race[]
  sgLabels: Record<string, string>
  sgClass: Record<string, string>
}

const TIERS = [
  { key: 'all', label: 'All' },
  { key: 'wt', label: 'WorldTour' },
  { key: 'pro', label: 'Pro Series' },
  { key: 'champ', label: 'Championships' },
]

export default function RaceGrid({ races, sgLabels, sgClass }: Props) {
  const { user, isLogged, watchlist } = useUser()
  const [tier, setTier] = useState('all')
  const [tab, setTab] = useState('all')
  const [filterShow, setFilterShow] = useState('all')
  const [search, setSearch] = useState('')
  const [logModal, setLogModal] = useState<{ race: Race; years: number[] } | null>(null)
  const [yearsCache, setYearsCache] = useState<Record<string, number[]>>({})

  const isWT = (r: Race) => r.tier === 'WT'
  const isChamp = (r: Race) => r.race_type === 'championship'

  const typeTabsForTier = useMemo(() => {
    return [...new Set(races.filter(r => {
      if (tier === 'wt') return isWT(r) && !isChamp(r)
      if (tier === 'pro') return !isWT(r) && !isChamp(r)
      if (tier === 'champ') return isChamp(r)
      return !isChamp(r)
    }).map(r => r.race_type).filter(Boolean))]
  }, [races, tier])

  const filtered = useMemo(() => {
    return races.filter(r => {
      if (tier === 'wt' && (!isWT(r) || isChamp(r))) return false
      if (tier === 'pro' && (isWT(r) || isChamp(r))) return false
      if (tier === 'champ' && !isChamp(r)) return false
      if (tier !== 'champ' && tab !== 'all' && r.race_type !== tab) return false
      if (filterShow === 'logged' && !isLogged(r.slug)) return false
      if (filterShow === 'unlogged' && isLogged(r.slug)) return false
      if (filterShow === 'watchlist' && !watchlist.includes(r.slug)) return false
      if (search && !r.race_name.toLowerCase().includes(search.toLowerCase()) && !r.country.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [races, tier, tab, filterShow, search, isLogged, watchlist])

  async function openLogModal(race: Race, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { window.location.href = '/login'; return }
    // Load available years if not cached
    let years = yearsCache[race.slug]
    if (!years) {
      const { data } = await supabase.from('race_results').select('year').eq('slug', race.slug).order('year', { ascending: false })
      years = (data || []).map((r: any) => r.year)
      setYearsCache(prev => ({ ...prev, [race.slug]: years }))
    }
    setLogModal({ race, years })
  }

  return (
    <div>
      {/* Tier bar */}
      <div className="tier-bar">
        {TIERS.map(t => (
          <button key={t.key} className={`tier-btn${tier === t.key ? ' active' : ''}`}
            onClick={() => { setTier(t.key); setTab('all') }}>{t.label}</button>
        ))}
      </div>

      {/* Type tabs */}
      {typeTabsForTier.length > 0 && (
        <div className="tabs">
          <div className={`tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>All</div>
          {typeTabsForTier.map(t => (
            <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="fbar">
        <span className="fl">Show:</span>
        {[['all', 'All'], ['logged', 'Logged'], ['unlogged', 'Unlogged'], ['watchlist', 'Watchlist']].map(([v, l]) => (
          <button key={v} className={`fb${filterShow === v ? ' active' : ''}`} onClick={() => setFilterShow(v)}>{l}</button>
        ))}
      </div>

      {/* Search */}
      <div className="search-wrap-disc">
        <input className="search-disc" type="text" placeholder="Search races…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      <div className="main-layout">
        <div className="main-content">
          {filtered.length === 0
            ? <div className="empty">No races match your search.</div>
            : <div className="race-grid">
                {filtered.map(race => (
                  <RaceCard key={race.slug} race={race} sgLabels={sgLabels} sgClass={sgClass}
                    onLog={e => openLogModal(race, e)} />
                ))}
              </div>
          }
        </div>
        <div className="sidebar">
          <RecentActivitySidebar />
        </div>
      </div>

      {logModal && (
        <LogRaceModal
          slug={logModal.race.slug}
          raceName={logModal.race.race_name}
          gradient={logModal.race.gradient || '#1a1a1a'}
          availYears={logModal.years}
          onClose={() => setLogModal(null)}
        />
      )}
    </div>
  )
}

// ── Race Card ─────────────────────────────────────────────────────────────────

function RaceCard({ race, sgLabels, sgClass, onLog }: {
  race: Race
  sgLabels: Record<string, string>
  sgClass: Record<string, string>
  onLog: (e: React.MouseEvent) => void
}) {
  const { isLogged, getBestRating, watchlist, toggleWatchlist, user } = useUser()
  const logged = isLogged(race.slug)
  const rating = getBestRating(race.slug)
  const inWL = watchlist.includes(race.slug)

  function handleWatchlist(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { window.location.href = '/login'; return }
    toggleWatchlist(race.slug)
  }

  return (
    <Link href={`/races/${race.slug}`} className="rc" style={{ textDecoration: 'none' }}>
      <div className="rc-img" style={{ background: race.gradient || '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
        <span className="rc-cat">{race.race_type === 'championship' ? 'CHAMPS' : race.race_type?.toUpperCase()}</span>
        {race.tier === 'WT' && race.race_type !== 'championship' && <span className="rc-wt">WT</span>}
        {race.logo_url && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 8px 22px' }}>
            <img src={race.logo_url} alt={race.race_name}
              style={{ maxWidth: '80%', maxHeight: '70%', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.5))' }}
              onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
          </div>
        )}
      </div>
      <div className="rc-body">
        <div className="rc-ctry">{race.flag} {race.country}</div>
        <div className="rc-name">{race.race_name}</div>
        <div className="rc-yr">Est. {race.first_year}</div>
        {rating > 0 && (
          <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 4 }}>
            {'★'.repeat(Math.floor(rating))}{rating % 1 ? '½' : ''} {rating.toFixed(1)}
          </div>
        )}
        {race.subgenres && race.subgenres.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {race.subgenres.slice(0, 2).map(sg => (
              <span key={sg} className={`sg-badge ${sgClass[sg] || ''}`}>{sgLabels[sg] || sg}</span>
            ))}
          </div>
        )}
        <div className="ra">
          <button className={`bsm logged${logged ? ' active' : ''}`} onClick={onLog}>
            {logged ? `✓ Logged` : '+ Log'}
          </button>
          <button className={`bsm${inWL ? ' active' : ''}`} onClick={handleWatchlist}>
            {inWL ? '★' : '☆'}
          </button>
        </div>
      </div>
    </Link>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function RecentActivitySidebar() {
  const { user, logs } = useUser()
  const [races, setRaces] = useState<Record<string, any>>({})

  useMemo(() => {
    const slugs = Object.keys(logs).slice(0, 10)
    if (!slugs.length) return
    supabase.from('races').select('slug,race_name,gradient').in('slug', slugs).then(({ data }) => {
      const map: Record<string, any> = {}
      ;(data || []).forEach((r: any) => { map[r.slug] = r })
      setRaces(map)
    })
  }, [logs])

  if (!user) return (
    <div className="empty-log">
      <Link href="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to track your races.
    </div>
  )

  const recent = Object.entries(logs)
    .flatMap(([slug, entries]) => entries.map(e => ({ ...e, slug })))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  if (!recent.length) return <div className="empty-log">Your logged races will appear here.</div>

  return (
    <div>
      {recent.map(log => {
        const r = races[log.slug]
        return (
          <Link key={log.id} href={`/races/${log.slug}/${log.year}`} className="sle" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="sle-d">{log.year}</div>
            <div className="sle-name">{r?.race_name || log.slug}</div>
            {log.rating && <div className="sle-yr">★ {log.rating}</div>}
          </Link>
        )
      })}
    </div>
  )
}
