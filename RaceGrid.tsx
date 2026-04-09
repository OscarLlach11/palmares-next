'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Race } from '@/lib/supabase'

interface Props {
  races: Race[]
  grandTours: Race[]
  monuments: Race[]
  classics: Race[]
  stageRaces: Race[]
  oneDay: Race[]
  championships: Race[]
  sgLabels: Record<string, string>
  sgClass: Record<string, string>
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'grand-tour', label: 'Grand Tours' },
  { key: 'monument', label: 'Monuments' },
  { key: 'classic', label: 'Classics' },
  { key: 'stage-race', label: 'Stage Races' },
  { key: 'one-day', label: 'One Day' },
  { key: 'championship', label: 'Championships' },
]

const TIERS = [
  { key: 'all', label: 'All' },
  { key: 'wt', label: 'WorldTour' },
  { key: 'pro', label: 'Pro Series' },
  { key: 'champ', label: 'Championships' },
]

export default function RaceGrid({ races, sgLabels, sgClass }: Props) {
  const [tab, setTab] = useState('all')
  const [tier, setTier] = useState('all')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return races.filter(r => {
      if (tab !== 'all') {
        const typeMap: Record<string, string> = {
          'grand-tour': 'Grand Tour', 'monument': 'Monument', 'classic': 'Classic',
          'stage-race': 'Stage Race', 'one-day': 'One Day', 'championship': 'championship',
        }
        if (r.race_type !== typeMap[tab]) return false
      }
      if (tier === 'wt' && r.tier !== 'WT') return false
      if (tier === 'pro' && r.tier !== 'Pro') return false
      if (tier === 'champ' && r.tier !== 'Championship') return false
      if (search && !r.race_name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [races, tab, tier, filter, search])

  return (
    <div>
      {/* Tier bar */}
      <div className="tier-bar">
        {TIERS.map(t => (
          <button key={t.key} className={`tier-btn${tier === t.key ? ' active' : ''}`} onClick={() => setTier(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Type tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="fbar">
        <span className="fl">Show:</span>
        {['all', 'logged', 'unlogged', 'watchlist'].map(f => (
          <button key={f} className={`fb${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-wrap-disc">
        <input
          className="search-disc"
          type="text"
          placeholder="Search races…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="race-grid">
        {filtered.map(race => (
          <RaceCard key={race.slug} race={race} sgLabels={sgLabels} sgClass={sgClass} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty">No races match your search.</div>
      )}
    </div>
  )
}

function RaceCard({ race, sgLabels, sgClass }: { race: Race; sgLabels: Record<string, string>; sgClass: Record<string, string> }) {
  const years = race.tv_year
    ? `${race.tv_year}–${race.last_year || 'present'}`
    : `${race.first_year}–${race.last_year || 'present'}`

  return (
    <Link href={`/races/${race.slug}`} className="rc" style={{ textDecoration: 'none' }}>
      <div className="rc-img" style={{ background: race.gradient || '#1a1a1a' }}>
        {race.logo_url && (
          <img
            src={race.logo_url}
            alt={race.race_name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: '8px', opacity: 0.9 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        {race.tier === 'WT' && <span className="rc-wt">WT</span>}
        <span className="rc-cat">{race.race_type}</span>
      </div>
      <div className="rc-body">
        <div className="rc-ctry">{race.flag} {race.country}</div>
        <div className="rc-name">{race.race_name}</div>
        <div className="rc-yr">{years}</div>
        {race.subgenres && race.subgenres.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {race.subgenres.slice(0, 2).map(sg => (
              <span key={sg} className={`sg-badge ${sgClass[sg] || ''}`}>{sgLabels[sg] || sg}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
