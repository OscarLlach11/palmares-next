'use client'
import { useState, useMemo, useEffect } from 'react'
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

function formatRiderName(name: string): string {
  if (!name) return ''
  return name.split(' ').map(w =>
    w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w
  ).join(' ')
}

function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c', '#00594a', '#c0392b', '#9a8430', '#4527a0', '#00838f', '#6d4c41', '#1a4db3']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

function riderInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ── Riders Section ────────────────────────────────────────────────────────────
// REPLACE the entire RidersSection function AND the RiderRow interface
// in RaceGrid.tsx with this block.
// Also replace the existing formatRiderName function at the top of RaceGrid.tsx
// with the one below (it correctly handles DB-format "LASTNAME Firstname" → "Firstname Lastname")

// ── Name helpers (replace the existing formatRiderName at top of file) ────────

function _isAllCaps(w: string): boolean {
  return w.length > 0 && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑČŠŽĆĐ]/u.test(w)
}

// DB stores names as "LASTNAME Firstname" (uppercase words = last name)
// This converts to "Firstname Lastname" for display
function formatRiderName(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  // Find where uppercase words end (those are the last name)
  let splitIdx = parts.length
  for (let i = 0; i < parts.length; i++) {
    if (!_isAllCaps(parts[i])) { splitIdx = i; break }
  }
  const last = parts.slice(0, splitIdx).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const first = parts.slice(splitIdx).join(' ')
  return first ? `${first} ${last}` : last
}

// ── RidersSection ─────────────────────────────────────────────────────────────

interface RiderRow {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

function RidersSection() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RiderRow[]>([])
  const [featured, setFeatured] = useState<RiderRow[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [label, setLabel] = useState('Featured Riders')

  useEffect(() => {
    loadFeatured()
  }, [])

  async function loadFeatured() {
    setFeaturedLoading(true)

    // 1. Get featured rider names from app_config
    const { data: configRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'featured_riders')
      .maybeSingle()

    const entries: any[] = Array.isArray(configRow?.value) ? configRow.value : []
    if (!entries.length) { setFeaturedLoading(false); return }

    const extractName = (e: any) => typeof e === 'object' ? (e?.name || '') : (e || '')
    const names: string[] = entries.map(extractName).filter(Boolean)

    // 2. Fetch all riders in a SINGLE batch query using ilike with OR
    // Build a search string that catches all of them
    // Strategy: fetch a generous batch from startlists ordered by year desc,
    // then match by name (case-insensitive)
    const { data: rows } = await supabase
      .from('startlists')
      .select('rider_name,team_name,nationality,image_url,year')
      .order('year', { ascending: false })
      .limit(2000)

    if (!rows?.length) { setFeaturedLoading(false); return }

    // 3. For each featured name, find the best matching row
    // "Best" = has image, then most recent year
    const result: RiderRow[] = names.map(name => {
      const nameLower = name.toLowerCase()
      // Find all rows whose rider_name matches this name (case-insensitive)
      const matches = rows.filter((r: any) => r.rider_name.toLowerCase() === nameLower)

      if (!matches.length) {
        // Fuzzy: try surname-only match (last word of the name, which in DB format is first word)
        const surname = name.split(' ')[0].toLowerCase() // DB format: SURNAME is first
        const fuzzy = rows.filter((r: any) =>
          r.rider_name.toLowerCase().startsWith(surname + ' ') ||
          r.rider_name.toLowerCase() === surname
        )
        if (!fuzzy.length) {
          return { rider_name: name, team_name: null, nationality: null, image_url: null }
        }
        return pickBest(fuzzy)
      }

      return pickBest(matches)
    })

    setFeatured(result)
    setFeaturedLoading(false)
  }

  function pickBest(rows: any[]): RiderRow {
    // Sort: image present first, then most recent year
    const sorted = [...rows].sort((a, b) => {
      const aImg = a.image_url && a.image_url !== 'none' ? 1 : 0
      const bImg = b.image_url && b.image_url !== 'none' ? 1 : 0
      if (bImg !== aImg) return bImg - aImg
      return (b.year || 0) - (a.year || 0)
    })
    const best = sorted[0]
    // Use latest entry for team name (most up-to-date)
    const latest = rows.reduce((a, b) => ((b.year || 0) > (a.year || 0) ? b : a), rows[0])
    return {
      rider_name: best.rider_name,
      team_name: latest.team_name,
      nationality: latest.nationality,
      image_url: best.image_url && best.image_url !== 'none' ? best.image_url : null,
    }
  }

  // Search: debounced, fires on 2+ chars
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setLabel('Featured Riders')
      setSearching(false)
      return
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      // Search supports "Tadej Pogacar" style (display order) by trying both orderings
      const q = query.trim()

      const { data } = await supabase
        .from('startlists')
        .select('rider_name,team_name,nationality,image_url,year')
        .ilike('rider_name', `%${q}%`)
        .order('year', { ascending: false })
        .limit(200)

      // Deduplicate by rider_name (case-insensitive), keeping best image + latest team
      const grouped = new Map<string, any[]>()
      ;(data || []).forEach((r: any) => {
        const key = r.rider_name.toLowerCase()
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(r)
      })

      const unique: RiderRow[] = Array.from(grouped.values())
        .map(pickBest)
        .slice(0, 30)

      setResults(unique)
      setLabel(`${unique.length} result${unique.length !== 1 ? 's' : ''}`)
      setSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const displayList = query.length >= 2 ? results : featured
  const isLoading = featuredLoading && query.length < 2

  return (
    <div>
      <div style={{
        padding: '22px 40px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, marginBottom: 4 }}>
            Rider Database
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Search thousands of professional cyclists.
          </div>
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search riders…"
          style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            color: 'var(--fg)', padding: '8px 14px', fontSize: 13, width: 220, outline: 'none',
          }}
        />
      </div>

      <div style={{ padding: '28px 40px' }}>
        <div style={{
          fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
          color: 'var(--muted)', marginBottom: 18,
        }}>
          {searching ? 'Searching…' : label}
        </div>

        {isLoading ? (
          // Skeleton placeholders while loading
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 16 }}>
            {[...Array(10)].map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ aspectRatio: '2/3', marginBottom: 8, borderRadius: 2 }} />
                <div className="skeleton skeleton-text" style={{ width: '80%' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 16 }}>
            {displayList.map(r => {
              const hasImg = r.image_url && r.image_url !== 'none'
              const col = riderColor(r.rider_name)
              const ini = riderInitials(r.rider_name)
              return (
                <Link
                  key={r.rider_name}
                  href={`/riders/${encodeURIComponent(r.rider_name)}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div style={{
                    aspectRatio: '2/3', background: col, overflow: 'hidden',
                    position: 'relative', marginBottom: 8,
                  }}>
                    {hasImg ? (
                      <img
                        src={r.image_url!}
                        alt={formatRiderName(r.rider_name)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#fff',
                      }}>
                        {ini}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg)', lineHeight: 1.3, marginBottom: 2 }}>
                    {formatRiderName(r.rider_name)}
                  </div>
                  {r.team_name && (
                    <div style={{
                      fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.team_name}
                    </div>
                  )}
                </Link>
              )
            })}
            {!searching && query.length >= 2 && results.length === 0 && (
              <div style={{ gridColumn: '1/-1', color: 'var(--muted)', fontSize: 12 }}>
                No riders found for "{query}".
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main RaceGrid ─────────────────────────────────────────────────────────────

export default function RaceGrid({ races, sgLabels, sgClass }: Props) {
  const { user, isLogged, watchlist } = useUser()
  const [discoverSection, setDiscoverSection] = useState<'races' | 'riders'>('races')
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
      if (search && !r.race_name.toLowerCase().includes(search.toLowerCase()) && !(r.country || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [races, tier, tab, filterShow, search, isLogged, watchlist])

  async function openLogModal(race: Race, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { window.location.href = '/login'; return }
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
      {/* Discover sub-tabs: Races / Riders */}
      <div className="disc-subtabs">
        <button className={`disc-subtab${discoverSection === 'races' ? ' active' : ''}`}
          onClick={() => setDiscoverSection('races')}>Races</button>
        <button className={`disc-subtab${discoverSection === 'riders' ? ' active' : ''}`}
          onClick={() => setDiscoverSection('riders')}>Riders</button>
      </div>

      {/* Riders section */}
      {discoverSection === 'riders' && <RidersSection />}

      {/* Races section */}
      {discoverSection === 'races' && (
        <>
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

          {/* Grid + sidebar */}
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
        </>
      )}

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
              style={{ maxWidth: '80%', maxHeight: '70%', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.5))' }} />
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
  const [raceNames, setRaceNames] = useState<Record<string, string>>({})
  const [raceGradients, setRaceGradients] = useState<Record<string, string>>({})

  const recent = useMemo(() => {
    return Object.values(logs).flat()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8) as any[]
  }, [logs])

  useEffect(() => {
    const slugs = [...new Set(recent.map(l => l.slug))]
    if (!slugs.length) return
    supabase.from('races').select('slug,race_name,gradient').in('slug', slugs)
      .then(({ data }) => {
        const names: Record<string, string> = {}
        const gradients: Record<string, string> = {}
        ;(data || []).forEach((r: any) => { names[r.slug] = r.race_name; gradients[r.slug] = r.gradient })
        setRaceNames(names)
        setRaceGradients(gradients)
      })
  }, [recent])

  if (!user) return (
    <div className="empty-log">
      <Link href="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to track your races.
    </div>
  )

  if (!recent.length) return <div className="empty-log">Your logged races will appear here.</div>

  return (
    <div>
      {recent.map((log: any) => (
        <Link key={log.id} href={`/races/${log.slug}/${log.year}`} className="sle" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 4, height: 32, background: raceGradients[log.slug] || 'var(--border)', flexShrink: 0, borderRadius: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sle-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {raceNames[log.slug] || log.slug}
              </div>
              <div className="sle-yr">{log.year}{log.rating ? ` · ★ ${log.rating.toFixed(1)}` : ''}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
