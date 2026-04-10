'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import LogRaceModal from './LogRaceModal'

interface Race {
  slug: string
  race_name: string
  flag: string
  gradient: string
  race_type: string
}

interface Props {
  onClose: () => void
}

export default function LogRaceSearch({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Race[]>([])
  const [selected, setSelected] = useState<Race | null>(null)
  const [availYears, setAvailYears] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('races')
        .select('slug,race_name,flag,gradient,race_type')
        .ilike('race_name', `%${query}%`)
        .limit(20)
      setResults(data || [])
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  async function selectRace(race: Race) {
    const { data } = await supabase
      .from('race_results')
      .select('year')
      .eq('slug', race.slug)
      .order('year', { ascending: false })
    setAvailYears((data || []).map((r: any) => r.year))
    setSelected(race)
  }

  if (selected) {
    return (
      <LogRaceModal
        slug={selected.slug}
        raceName={selected.race_name}
        gradient={selected.gradient || '#1a1a1a'}
        availYears={availYears}
        onClose={onClose}
      />
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', maxWidth: 560, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: 'var(--gold)' }}>Log a Race</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="SEARCH RACES…"
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Searching…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No races found for "{query}"</div>
          )}
          {!loading && query.length < 2 && (
            <div style={{ padding: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Type at least 2 characters to search</div>
          )}
          {results.map(race => (
            <div
              key={race.slug}
              onClick={() => selectRace(race)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 40, height: 40, background: race.gradient || '#1a1a1a', flexShrink: 0, borderRadius: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontFamily: "'DM Serif Display', serif" }}>{race.race_name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, marginTop: 2 }}>{race.flag} {race.race_type}</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2 }}>Log →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
