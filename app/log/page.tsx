'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [logs, setLogs] = useState<RaceLog[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterLive, setFilterLive] = useState('')
  const [filterRating, setFilterRating] = useState(0)
  const [filterCountry, setFilterCountry] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [search, setSearch] = useState('')
  const [openDD, setOpenDD] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setLoading(false); return }
      setUser(data.session.user)
      const [logsRes, racesRes] = await Promise.all([
        supabase.from('race_logs').select('*').eq('user_id', data.session.user.id).order('created_at', { ascending: false }),
        supabase.from('races').select('slug,race_name,gradient,flag,country,race_type'),
      ])
      setLogs((logsRes.data || []) as RaceLog[])
      setRaces((racesRes.data || []) as Race[])
      setLoading(false)
    })
  }, [])

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

  const rated = logs.filter(l => l.rating && l.rating > 0)
  const avg = rated.length ? (rated.reduce((s, l) => s + (l.rating || 0), 0) / rated.length).toFixed(1) : '—'
  const liveCount = logs.filter(l => l.watched_live).length
  const distinctRaces = new Set(logs.map(l => l.slug)).size

  // Countries for filter
  const countryCounts: Record<string, number> = {}
  logs.forEach(l => {
    const r = races.find(x => x.slug === l.slug)
    if (r?.country) countryCounts[r.country] = (countryCounts[r.country] || 0) + 1
  })

  // Filter + sort
  let filtered = logs.filter(l => {
    const r = races.find(x => x.slug === l.slug)
    if (filterType && r?.race_type !== filterType) return false
    if (filterLive === 'live' && !l.watched_live) return false
    if (filterLive === 'replay' && l.watched_live) return false
    if (filterRating && (l.rating || 0) < filterRating) return false
    if (filterCountry && r?.country !== filterCountry) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r?.race_name || l.slug).toLowerCase().includes(q)) return false
    }
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sortBy === 'name') {
      const ra = races.find(x => x.slug === a.slug)?.race_name || a.slug
      const rb = races.find(x => x.slug === b.slug)?.race_name || b.slug
      return ra.localeCompare(rb)
    }
    if (sortBy === 'year') return b.year - a.year
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const hasFilters = filterType || filterLive || filterRating || filterCountry

  return (
    <div>
      {/* Hero */}
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">LOG</div>
        <div className="eyebrow">— Your Cycling Diary</div>
        <h1>My <em>Journal</em></h1>
        <div className="hstats" style={{ marginTop: 16 }}>
          <div><div className="hstat-n">{logs.length}</div><div className="hstat-l">Races</div></div>
          <div><div className="hstat-n">{avg}</div><div className="hstat-l">Avg Rating</div></div>
          <div><div className="hstat-n">{liveCount}</div><div className="hstat-l">Watched Live</div></div>
          <div><div className="hstat-n">{distinctRaces}</div><div className="hstat-l">Distinct Races</div></div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 40px', flexWrap: 'wrap', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 5 }}>
        <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginRight: 16, padding: '14px 0' }}>Filter</span>

        {/* Type */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpenDD(openDD === 'type' ? '' : 'type')}
            style={{ background: 'none', border: 'none', color: filterType ? 'var(--gold)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', padding: '14px 16px', cursor: 'pointer' }}>
            Type {filterType ? `· ${filterType}` : ''} ▾
          </button>
          {openDD === 'type' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', minWidth: 180, zIndex: 100 }}>
              {['', 'Grand Tour', 'Monument', 'Classic', 'Stage Race', 'One Day'].map(t => (
                <div key={t} onClick={() => { setFilterType(t); setOpenDD('') }}
                  style={{ padding: '9px 16px', fontSize: 12, color: filterType === t ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', background: 'transparent' }}>
                  {t || 'All Types'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Country */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpenDD(openDD === 'country' ? '' : 'country')}
            style={{ background: 'none', border: 'none', color: filterCountry ? 'var(--gold)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', padding: '14px 16px', cursor: 'pointer' }}>
            Country {filterCountry ? `· ${filterCountry}` : ''} ▾
          </button>
          {openDD === 'country' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', minWidth: 180, zIndex: 100, maxHeight: 240, overflowY: 'auto' }}>
              <div onClick={() => { setFilterCountry(''); setOpenDD('') }} style={{ padding: '9px 16px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>All Countries</div>
              {Object.keys(countryCounts).sort().map(c => (
                <div key={c} onClick={() => { setFilterCountry(c); setOpenDD('') }}
                  style={{ padding: '9px 16px', fontSize: 12, color: filterCountry === c ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer' }}>
                  {c} ({countryCounts[c]})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live */}
        <div style={{ position: 'relative' }}>
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
        <div style={{ position: 'relative' }}>
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
          style={{ marginLeft: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '6px 12px', fontSize: 12, outline: 'none', width: 180 }} />

        {hasFilters && (
          <button onClick={() => { setFilterType(''); setFilterLive(''); setFilterRating(0); setFilterCountry('') }}
            style={{ marginLeft: 12, fontSize: 10, letterSpacing: 1, color: 'var(--gold)', background: 'none', border: '1px solid var(--gold-dim)', padding: '5px 12px', cursor: 'pointer' }}>
            ✕ Clear Filters
          </button>
        )}
      </div>

      {/* Log list */}
      <div id="log-list" onClick={() => setOpenDD('')}>
        {filtered.length === 0 ? (
          <div className="empty">No races logged yet.</div>
        ) : filtered.map(l => {
          const r = races.find(x => x.slug === l.slug)
          return (
            <Link key={l.id} href={`/races/${l.slug}/${l.year}`}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 40px', borderBottom: '1px solid var(--border)', textDecoration: 'none', transition: 'background .1s' }}
              className="lbi">
              <div style={{ width: 6, height: 48, background: r?.gradient || 'var(--border)', flexShrink: 0, borderRadius: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontFamily: "'DM Serif Display', serif", color: 'var(--fg)' }}>
                  {r?.race_name || l.slug} <span style={{ color: 'var(--muted)', fontSize: 13 }}>{l.year}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {[l.date_watched ? fmtDate(l.date_watched) : '', l.watched_live ? '🔴 Live' : ''].filter(Boolean).join(' · ')}
                </div>
                {l.review && <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>"{l.review.slice(0, 120)}{l.review.length > 120 ? '…' : ''}"</div>}
              </div>
              {l.rating && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--gold)' }}>{l.rating.toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1 }}>/ 5.0</div>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
