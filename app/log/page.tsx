'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import { useToast } from '@/app/context/ToastContext'
import LogRaceModal from '@/app/components/LogRaceModal'

function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

type RaceLog = {
  id: string; slug: string; year: number; rating: number | null
  review: string | null; watched_live: boolean; date_watched: string | null; created_at: string
}
type Race = { slug: string; race_name: string; gradient: string; flag: string; country: string; race_type: string }

const RATING_LABELS: Record<string, string> = {
  '0.5': 'Just Riding',
  '1.0': 'Forgettable',
  '1.5': 'Below Average',
  '2.0': 'Decent',
  '2.5': 'Solid',
  '3.0': 'Good',
  '3.5': 'Very Good',
  '4.0': 'Great',
  '4.5': 'Exceptional',
  '5.0': 'All-Time Classic',
}

// ── Interactive half-star rating selector ─────────────────────────────────────
function StarRatingSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map(star => {
          const full = display >= star
          const half = !full && display >= star - 0.5
          return (
            <div key={star} style={{ position: 'relative', width: 30, height: 30, cursor: 'pointer' }}>
              {/* left half → half-star */}
              <div
                style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 2 }}
                onMouseEnter={() => setHovered(star - 0.5)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => onChange(value === star - 0.5 ? 0 : star - 0.5)}
              />
              {/* right half → full star */}
              <div
                style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', zIndex: 2 }}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => onChange(value === star ? 0 : star)}
              />
              {/* base (empty) star */}
              <svg width={30} height={30} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
                <path fill="var(--border-light)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {/* half fill */}
              {half && (
                <svg width={30} height={30} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0, clipPath: 'inset(0 50% 0 0)' }}>
                  <path fill="var(--gold)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
              {/* full fill */}
              {full && (
                <svg width={30} height={30} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <path fill="var(--gold)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
      {/* Value + label */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minHeight: 24 }}>
        {display > 0 ? (
          <>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>
              {display.toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {RATING_LABELS[display.toFixed(1)] || ''}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--border-light)' }}>Any Rating</span>
        )}
      </div>
    </div>
  )
}

// ── Filter section heading ─────────────────────────────────────────────────────
function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
      color: 'var(--muted)', marginBottom: 10, marginTop: 22,
      borderTop: '1px solid var(--border)', paddingTop: 14,
    }}>
      {children}
    </div>
  )
}

function LogPageInner() {
  const searchParams = useSearchParams()
  const { user, logs: contextLogs, refreshLogs } = useUser()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [races, setRaces] = useState<Record<string, Race>>({})

  const [filterRating, setFilterRating] = useState<number>(() => {
    const v = parseFloat(searchParams.get('rating') || '0')
    return isNaN(v) ? 0 : v
  })
  const [filterCountry, setFilterCountry] = useState(() => searchParams.get('country') || '')
  const [filterType, setFilterType] = useState('')
  const [filterLive, setFilterLive] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [search, setSearch] = useState('')

  const [editModal, setEditModal] = useState<{ slug: string; raceName: string; gradient: string; years: number[] } | null>(null)
  const [yearsCache, setYearsCache] = useState<Record<string, number[]>>({})
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  const allLogs: RaceLog[] = Object.values(contextLogs).flat() as RaceLog[]

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('races').select('slug,race_name,gradient,flag,country,race_type')
      .then(({ data }) => {
        const map: Record<string, Race> = {}
        ;(data || []).forEach((r: any) => { map[r.slug] = r })
        setRaces(map)
        setLoading(false)
      })
  }, [user])

  async function openEdit(slug: string) {
    const race = races[slug]
    if (!race) return
    let years = yearsCache[slug]
    if (!years) {
      const { data } = await supabase.from('race_results').select('year').eq('slug', slug).order('year', { ascending: false })
      years = (data || []).map((r: any) => r.year)
      setYearsCache(prev => ({ ...prev, [slug]: years }))
    }
    setEditModal({ slug, raceName: race.race_name, gradient: race.gradient || '#1a1a1a', years })
  }

  async function confirmClearAll() {
    if (!user) return
    setClearing(true)
    await supabase.from('race_logs').delete().eq('user_id', user.id)
    await refreshLogs()
    setClearing(false)
    setConfirmClear(false)
    showToast('All logs cleared.')
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  if (!user) return (
    <div className="hero">
      <div className="hero-bg">LOG</div>
      <div className="eyebrow">— Your Cycling Diary</div>
      <h1>My <em>Journal</em></h1>
      <p className="hero-sub" style={{ marginTop: 16 }}>Sign in to start logging the races you watch.</p>
      <Link href="/login" className="bp" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>Sign In</Link>
    </div>
  )

  const rated = allLogs.filter(l => l.rating && l.rating > 0)
  const avg = rated.length ? (rated.reduce((s, l) => s + (l.rating || 0), 0) / rated.length).toFixed(1) : '—'
  const liveCount = allLogs.filter(l => l.watched_live).length
  const distinctRaces = new Set(allLogs.map(l => l.slug)).size

  // Countries from user's actual logs
  const countryCounts: Record<string, number> = {}
  allLogs.forEach(l => {
    const r = races[l.slug]
    if (r?.country) {
      const key = `${r.flag || ''} ${r.country}`.trim()
      countryCounts[key] = (countryCounts[key] || 0) + 1
    }
  })
  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])

  // Race types from user's actual logs
  const typeSet = new Set<string>()
  allLogs.forEach(l => { const t = races[l.slug]?.race_type; if (t) typeSet.add(t) })
  const availableTypes = Array.from(typeSet).sort()

  // Filter
  let filtered = allLogs.filter(l => {
    const r = races[l.slug]
    if (filterType && r?.race_type !== filterType) return false
    if (filterLive === 'live' && !l.watched_live) return false
    if (filterLive === 'replay' && l.watched_live) return false
    if (filterCountry) {
      const key = `${r?.flag || ''} ${r?.country || ''}`.trim()
      if (key !== filterCountry) return false
    }
    if (filterRating > 0) {
      if ((l.rating || 0) !== filterRating) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!(r?.race_name || l.slug).toLowerCase().includes(q)) return false
    }
    return true
  })

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sortBy === 'name') return (races[a.slug]?.race_name || a.slug).localeCompare(races[b.slug]?.race_name || b.slug)
    if (sortBy === 'year') return b.year - a.year
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const hasFilters = filterType || filterLive || filterCountry || filterRating > 0 || search

  function clearFilters() {
    setFilterType('')
    setFilterLive('')
    setFilterCountry('')
    setFilterRating(0)
    setSearch('')
  }

  return (
    <>
      {/* Hero */}
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">LOG</div>
        <div className="eyebrow">— Your Cycling Diary</div>
        <h1>My <em>Journal</em></h1>
        <div className="hstats" style={{ marginTop: 16 }}>
          <div><div className="hstat-n">{allLogs.length}</div><div className="hstat-l">Races</div></div>
          <div><div className="hstat-n">{avg}</div><div className="hstat-l">Avg Rating</div></div>
          <div><div className="hstat-n">{liveCount}</div><div className="hstat-l">Watched Live</div></div>
          <div><div className="hstat-n">{distinctRaces}</div><div className="hstat-l">Distinct Races</div></div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 300px)' }}>

        {/* ── Filter sidebar ───────────────────────────────────────────────── */}
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: '24px 20px 40px',
          position: 'sticky', top: 57,
          height: 'calc(100vh - 57px)',
          overflowY: 'auto',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: 'var(--gold)' }}>
              Filters
            </span>
            {hasFilters && (
              <button onClick={clearFilters} style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 9, letterSpacing: 1.5, cursor: 'pointer',
                textTransform: 'uppercase', padding: 0,
              }}>
                Clear all
              </button>
            )}
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search races…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              color: 'var(--fg)', padding: '8px 10px', fontSize: 12, outline: 'none',
            }}
          />

          {/* Rating */}
          <FilterLabel>Rating</FilterLabel>
          <StarRatingSelector value={filterRating} onChange={setFilterRating} />

          {/* Country */}
          {sortedCountries.length > 0 && (
            <>
              <FilterLabel>Country</FilterLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 200, overflowY: 'auto' }}>
                {sortedCountries.map(([country, cnt]) => (
                  <button
                    key={country}
                    onClick={() => setFilterCountry(filterCountry === country ? '' : country)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: filterCountry === country ? 'rgba(196,160,80,.1)' : 'transparent',
                      border: `1px solid ${filterCountry === country ? 'var(--gold-dim)' : 'transparent'}`,
                      color: filterCountry === country ? 'var(--gold)' : 'var(--muted)',
                      padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                      textAlign: 'left', transition: 'all .1s',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <span>{country}</span>
                    <span style={{ fontSize: 10, opacity: 0.55 }}>{cnt}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Type */}
          {availableTypes.length > 0 && (
            <>
              <FilterLabel>Type</FilterLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {availableTypes.map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(filterType === t ? '' : t)}
                    style={{
                      background: filterType === t ? 'rgba(196,160,80,.1)' : 'transparent',
                      border: `1px solid ${filterType === t ? 'var(--gold-dim)' : 'transparent'}`,
                      color: filterType === t ? 'var(--gold)' : 'var(--muted)',
                      padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                      textAlign: 'left', transition: 'all .1s',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Viewing */}
          <FilterLabel>Viewing</FilterLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[['live', '🔴 Live'], ['replay', 'Replay']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilterLive(filterLive === v ? '' : v)}
                style={{
                  background: filterLive === v ? 'rgba(196,160,80,.1)' : 'transparent',
                  border: `1px solid ${filterLive === v ? 'var(--gold-dim)' : 'transparent'}`,
                  color: filterLive === v ? 'var(--gold)' : 'var(--muted)',
                  padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                  textAlign: 'left', transition: 'all .1s',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Sort */}
          <FilterLabel>Sort By</FilterLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              ['date', 'Date Logged'],
              ['rating', 'Rating'],
              ['name', 'Race Name'],
              ['year', 'Edition Year'],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setSortBy(v)}
                style={{
                  background: sortBy === v ? 'rgba(196,160,80,.1)' : 'transparent',
                  border: `1px solid ${sortBy === v ? 'var(--gold-dim)' : 'transparent'}`,
                  color: sortBy === v ? 'var(--gold)' : 'var(--muted)',
                  padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                  textAlign: 'left', transition: 'all .1s',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── Log list ─────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Active filter chips */}
          {hasFilters && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              padding: '10px 32px', borderBottom: '1px solid var(--border)',
              background: 'rgba(196,160,80,.03)',
            }}>
              <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginRight: 4 }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
              {filterRating > 0 && (
                <Chip label={`★ ${filterRating.toFixed(1)}`} onClear={() => setFilterRating(0)} />
              )}
              {filterCountry && (
                <Chip label={filterCountry} onClear={() => setFilterCountry('')} />
              )}
              {filterType && (
                <Chip label={filterType} onClear={() => setFilterType('')} />
              )}
              {filterLive && (
                <Chip label={filterLive === 'live' ? '🔴 Live' : 'Replay'} onClear={() => setFilterLive('')} />
              )}
              {search && (
                <Chip label={`"${search}"`} onClear={() => setSearch('')} />
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty">
              {allLogs.length === 0 ? "No races logged yet. Click + Log Race to get started." : "No races match your filters."}
            </div>
          ) : filtered.map(l => {
            const r = races[l.slug]
            return (
              <div
                key={l.id}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 32px', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Link href={`/races/${l.slug}/${l.year}`} style={{ width: 6, height: 52, background: r?.gradient || 'var(--border)', flexShrink: 0, borderRadius: 2, textDecoration: 'none' }} />
                <Link href={`/races/${l.slug}/${l.year}`} style={{ flex: 1, textDecoration: 'none' }}>
                  <div style={{ fontSize: 14, fontFamily: "'DM Serif Display', serif", color: 'var(--fg)' }}>
                    {r?.race_name || l.slug} <span style={{ color: 'var(--muted)', fontSize: 13 }}>{l.year}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {[l.date_watched ? fmtDate(l.date_watched) : '', l.watched_live ? '🔴 Live' : ''].filter(Boolean).join(' · ')}
                  </div>
                  {l.review && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                      "{l.review.slice(0, 120)}{l.review.length > 120 ? '…' : ''}"
                    </div>
                  )}
                </Link>
                {l.rating ? (
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--gold)', flexShrink: 0 }}>★ {l.rating}</div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--border-light)', flexShrink: 0 }}>—</div>
                )}
                <button
                  onClick={() => openEdit(l.slug)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '4px 10px', fontSize: 10, letterSpacing: 1, cursor: 'pointer', flexShrink: 0 }}
                >
                  Edit
                </button>
              </div>
            )
          })}

          {allLogs.length > 0 && (
            <div style={{ margin: '60px 32px 40px', padding: 24, border: '1px solid #3a1a1a', background: '#1a0a0a' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: '#c0392b', marginBottom: 8 }}>Danger Zone</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Permanently delete all your race logs. This cannot be undone.</div>
              <button onClick={() => setConfirmClear(true)} style={{ background: 'none', border: '1px solid #c0392b', color: '#c0392b', padding: '8px 20px', fontSize: 11, letterSpacing: 1, cursor: 'pointer' }}>
                Clear All Logs
              </button>
            </div>
          )}
        </div>
      </div>

      {editModal && (
        <LogRaceModal
          slug={editModal.slug}
          raceName={editModal.raceName}
          gradient={editModal.gradient}
          availYears={editModal.years}
          onClose={() => { setEditModal(null); refreshLogs() }}
        />
      )}

      {confirmClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: 32, maxWidth: 400, width: '90%' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 12 }}>Clear All Logs?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently delete all {allLogs.length} race log{allLogs.length !== 1 ? 's' : ''}. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmClear(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '10px 0', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmClearAll} disabled={clearing} style={{ flex: 1, background: '#c0392b', border: 'none', color: '#fff', padding: '10px 0', fontSize: 12, cursor: 'pointer', opacity: clearing ? 0.6 : 1 }}>
                {clearing ? 'Clearing…' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--card-bg)', border: '1px solid var(--gold-dim)',
      padding: '3px 8px', fontSize: 11, color: 'var(--gold)',
    }}>
      {label}
      <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>
    </span>
  )
}

export default function LogPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>}>
      <LogPageInner />
    </Suspense>
  )
}
