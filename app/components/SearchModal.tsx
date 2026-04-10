'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface RaceResult {
  slug: string
  race_name: string
  flag: string
  gradient: string
  race_type: string
}

interface RiderResult {
  rider_name: string
  team_name: string | null
  image_url: string | null
}

interface Props {
  onClose: () => void
}

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

export default function SearchModal({ onClose }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [races, setRaces] = useState<RaceResult[]>([])
  const [riders, setRiders] = useState<RiderResult[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'races' | 'riders'>('races')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setRaces([]); setRiders([]); return }
    const timer = setTimeout(() => search(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  async function search(q: string) {
    setLoading(true)
    const [racesRes, ridersRes] = await Promise.all([
      supabase.from('races')
        .select('slug,race_name,flag,gradient,race_type')
        .ilike('race_name', `%${q}%`)
        .limit(15),
      supabase.from('startlists')
        .select('rider_name,team_name,image_url')
        .ilike('rider_name', `%${q}%`)
        .order('year', { ascending: false })
        .limit(50),
    ])

    setRaces(racesRes.data || [])

    // Deduplicate riders
    const seen = new Set<string>()
    const uniqueRiders: RiderResult[] = []
    for (const r of (ridersRes.data || [])) {
      if (!seen.has(r.rider_name)) {
        seen.add(r.rider_name)
        uniqueRiders.push(r)
        if (uniqueRiders.length >= 15) break
      }
    }
    setRiders(uniqueRiders)
    setLoading(false)
  }

  function navigate(href: string) {
    router.push(href)
    onClose()
  }

  const hasResults = races.length > 0 || riders.length > 0

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 16px', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', maxWidth: 600, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2} style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
            placeholder="Search races, riders…"
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--fg)', padding: '16px 12px', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, letterSpacing: 1, padding: 4 }}>ESC</button>
        </div>

        {/* Tabs — only show when there are results */}
        {hasResults && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {(['races', 'riders'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--gold)' : 'transparent'}`, color: tab === t ? 'var(--gold)' : 'var(--muted)', padding: '10px 20px', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, cursor: 'pointer', transition: 'color .15s' }}>
                {t.toUpperCase()}
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>
                  ({t === 'races' ? races.length : riders.length})
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {query.length < 2 && (
            <div style={{ padding: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Type at least 2 characters to search
            </div>
          )}
          {loading && query.length >= 2 && (
            <div style={{ padding: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Searching…</div>
          )}
          {!loading && query.length >= 2 && !hasResults && (
            <div style={{ padding: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              No results for "{query}"
            </div>
          )}

          {/* Race results */}
          {!loading && tab === 'races' && races.map(r => (
            <div key={r.slug} onClick={() => navigate(`/races/${r.slug}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 36, height: 36, background: r.gradient || '#1a1a1a', flexShrink: 0, borderRadius: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontFamily: "'DM Serif Display', serif" }}>{r.race_name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, marginTop: 2 }}>{r.flag} {r.race_type}</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1 }}>→</span>
            </div>
          ))}

          {/* Rider results */}
          {!loading && tab === 'riders' && riders.map(r => {
            const hasImg = r.image_url && r.image_url !== 'none'
            const col = riderColor(r.rider_name)
            const ini = riderInitials(r.rider_name)
            return (
              <div key={r.rider_name} onClick={() => navigate(`/riders/${encodeURIComponent(r.rider_name)}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 36, height: 36, flexShrink: 0, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: '#fff', overflow: 'hidden', borderRadius: 2 }}>
                  {hasImg
                    ? <img src={r.image_url!} alt={formatRiderName(r.rider_name)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                    : ini}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{formatRiderName(r.rider_name)}</div>
                  {r.team_name && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{r.team_name}</div>}
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1 }}>→</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
