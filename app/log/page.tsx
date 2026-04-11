'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
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

export default function LogPage() {
  const { user, logs: contextLogs, refreshLogs } = useUser()
  const [loading, setLoading] = useState(true)
  const [races, setRaces] = useState<Record<string, Race>>({})
  const [filterType, setFilterType] = useState('')
  const [filterLive, setFilterLive] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [search, setSearch] = useState('')
  const [openDD, setOpenDD] = useState('')
  const [editModal, setEditModal] = useState<{ slug: string; raceName: string; gradient: string; years: number[] } | null>(null)
  const [yearsCache, setYearsCache] = useState<Record<string, number[]>>({})
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Flatten context logs into a sorted array
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

  // Filter + sort
  let filtered = allLogs.filter(l => {
    const r = races[l.slug]
    if (filterType && r?.race_type !== filterType) return false
    if (filterLive === 'live' && !l.watched_live) return false
    if (filterLive === 'replay' && l.watched_live) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r?.race_name || l.slug).toLowerCase().includes(q)) return false
    }
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sortBy === 'name') {
      const ra = races[a.slug]?.race_name || a.slug
      const rb = races[b.slug]?.race_name || b.slug
      return ra.localeCompare(rb)
    }
    if (sortBy === 'year') return b.year - a.year
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const hasFilters = filterType || filterLive

  return (
    <>
    <div onClick={() => setOpenDD('')}>
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

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 40px', flexWrap: 'wrap', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 5 }}>
        <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginRight: 16, padding: '14px 0' }}>Filter</span>

        {/* Type */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenDD(openDD === 'type' ? '' : 'type')}
            style={{ background: 'none', border: 'none', color: filterType ? 'var(--gold)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', padding: '14px 16px', cursor: 'pointer' }}>
            Type {filterType ? `· ${filterType}` : ''} ▾
          </button>
          {openDD === 'type' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', minWidth: 180, zIndex: 100 }}>
              {['', 'Grand Tour', 'Monument', 'Classic', 'Stage Race', 'One Day'].map(t => (
                <div key={t} onClick={() => { setFilterType(t); setOpenDD('') }}
                  style={{ padding: '9px 16px', fontSize: 12, color: filterType === t ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer' }}>
                  {t || 'All Types'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenDD(openDD === 'live' ? '' : 'live')}
            style={{ background: 'none', border: 'none', color: filterLive ? 'var(--gold)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', padding: '14px 16px', cursor: 'pointer' }}>
            Viewing {filterLive ? `· ${filterLive}` : ''} ▾
          </button>
          {openDD === 'live' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', minWidth: 140, zIndex: 100 }}>
              {[['', 'All'], ['live', '🔴 Live'], ['replay', 'Replay']].map(([v, l]) => (
                <div key={v} onClick={() => { setFilterLive(v); setOpenDD('') }}
                  style={{ padding: '9px 16px', fontSize: 12, color: filterLive === v ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer' }}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* Sort */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenDD(openDD === 'sort' ? '' : 'sort')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', padding: '14px 16px', cursor: 'pointer' }}>
            Sort: <span style={{ color: 'var(--gold)' }}>{sortBy}</span> ▾
          </button>
          {openDD === 'sort' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', minWidth: 160, zIndex: 100 }}>
              {[['date', 'Date Logged'], ['rating', 'Rating'], ['name', 'Race Name'], ['year', 'Edition Year']].map(([v, l]) => (
                <div key={v} onClick={() => { setSortBy(v); setOpenDD('') }}
                  style={{ padding: '9px 16px', fontSize: 12, color: sortBy === v ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer' }}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          onClick={e => e.stopPropagation()}
          style={{ marginLeft: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '6px 12px', fontSize: 12, outline: 'none', width: 180 }} />

        {hasFilters && (
          <button onClick={() => { setFilterType(''); setFilterLive('') }}
            style={{ marginLeft: 12, fontSize: 10, letterSpacing: 1, color: 'var(--gold)', background: 'none', border: '1px solid var(--gold-dim)', padding: '5px 12px', cursor: 'pointer' }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Log list */}
      <div>
        {filtered.length === 0 ? (
          <div className="empty">
            {allLogs.length === 0 ? "No races logged yet. Click + Log Race to get started." : "No races match your filters."}
          </div>
        ) : filtered.map(l => {
          const r = races[l.slug]
          return (
            <div key={l.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 40px', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {/* Colour bar */}
              <Link href={`/races/${l.slug}/${l.year}`} style={{ width: 6, height: 52, background: r?.gradient || 'var(--border)', flexShrink: 0, borderRadius: 2, textDecoration: 'none' }} />

              {/* Info */}
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

              {/* Rating */}
              {l.rating ? (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--gold)', lineHeight: 1 }}>{l.rating.toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1 }}>/ 5.0</div>
                </div>
              ) : (
                <div style={{ width: 40 }} />
              )}

              {/* Edit button */}
              <button
                onClick={() => openEdit(l.slug)}
                className="bs"
                style={{ fontSize: 9, padding: '5px 10px', flexShrink: 0 }}>
                Edit
              </button>
            </div>
          )
        })}
      </div>

      {/* Danger zone */}
      {allLogs.length > 0 && (
        <div style={{ padding: '40px 40px 60px', borderTop: '1px solid var(--border)', marginTop: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>Danger Zone</div>
          <button
            onClick={() => setConfirmClear(true)}
            style={{ fontSize: 10, letterSpacing: 1, color: '#c0392b', background: 'none', border: '1px solid #c0392b44', padding: '7px 16px', cursor: 'pointer', textTransform: 'uppercase' }}>
            Clear All Logs
          </button>
        </div>
      )}
    </div>

    {/* Confirm clear modal */}
    {confirmClear && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onClick={() => setConfirmClear(false)}
      >
        <div
          style={{ background: 'var(--bg)', border: '1px solid #c0392b66', width: '100%', maxWidth: 400, padding: 32 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 12 }}>Clear All Logs?</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
            This will permanently delete all <strong style={{ color: 'var(--fg)' }}>{allLogs.length} race log{allLogs.length !== 1 ? 's' : ''}</strong> from your journal. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setConfirmClear(false)}
              className="bs"
              style={{ flex: 1, fontSize: 10, padding: '9px 0' }}>
              Cancel
            </button>
            <button
              onClick={confirmClearAll}
              disabled={clearing}
              style={{ flex: 1, fontSize: 10, letterSpacing: 1, padding: '9px 0', background: '#c0392b', color: '#fff', border: 'none', cursor: clearing ? 'not-allowed' : 'pointer', opacity: clearing ? 0.6 : 1, textTransform: 'uppercase' }}>
              {clearing ? 'Clearing…' : 'Yes, Delete All'}
            </button>
          </div>
        </div>
      </div>
    )}

    {editModal && (
      <LogRaceModal
        slug={editModal.slug}
        raceName={editModal.raceName}
        gradient={editModal.gradient}
        availYears={editModal.years}
        onClose={() => { setEditModal(null); refreshLogs() }}
      />
    )}
    </>
  )
}
