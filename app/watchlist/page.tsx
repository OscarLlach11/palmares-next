'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface Race {
  slug: string
  race_name: string
  gradient: string
  flag: string
  country: string
  race_type: string
  logo_url: string | null
  tier: string
}

export default function WatchlistPage() {
  const { user, watchlist, toggleWatchlist } = useUser()
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    if (!watchlist.length) { setRaces([]); setLoading(false); return }
    supabase
      .from('races')
      .select('slug,race_name,gradient,flag,country,race_type,logo_url,tier')
      .in('slug', watchlist)
      .then(({ data }) => {
        // Sort to match watchlist order
        const map: Record<string, Race> = {}
        ;(data || []).forEach((r: any) => { map[r.slug] = r })
        setRaces(watchlist.map(s => map[s]).filter(Boolean))
        setLoading(false)
      })
  }, [user, watchlist])

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  if (!user) return (
    <div className="hero">
      <div className="hero-bg">LIST</div>
      <div className="eyebrow">— Your Watchlist</div>
      <h1>My <em>Watchlist</em></h1>
      <p className="hero-sub" style={{ marginTop: 16 }}>Sign in to save races to your watchlist.</p>
      <Link href="/login" className="bp" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>Sign In</Link>
    </div>
  )

  return (
    <div>
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">LIST</div>
        <div className="eyebrow">— Races to Watch</div>
        <h1>My <em>Watchlist</em></h1>
        <div className="hstats">
          <div>
            <div className="hstat-n">{watchlist.length}</div>
            <div className="hstat-l">Saved Races</div>
          </div>
        </div>
      </div>

      {races.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
            No races saved yet. Click the ☆ button on any race to add it here.
          </div>
          <Link href="/" className="bp" style={{ textDecoration: 'none', display: 'inline-block' }}>Browse Races</Link>
        </div>
      ) : (
        <div>
          {races.map(r => (
            <div key={r.slug} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 40px', borderBottom: '1px solid var(--border)' }}>
              {/* Swatch */}
              <div style={{ width: 56, height: 56, background: r.gradient || '#1a1a1a', flexShrink: 0, borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                {r.logo_url && (
                  <img src={r.logo_url} alt={r.race_name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link href={`/races/${r.slug}`} style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, textDecoration: 'none', color: 'var(--fg)' }}>
                    {r.race_name}
                  </Link>
                  {r.tier === 'WT' && (
                    <span style={{ fontSize: 8, background: 'var(--gold)', color: '#000', padding: '1px 5px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>WT</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, letterSpacing: 1 }}>
                  {r.flag} {r.country} · {r.race_type}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href={`/races/${r.slug}`} className="bs" style={{ textDecoration: 'none', fontSize: 10, padding: '6px 14px' }}>
                  View
                </Link>
                <button
                  onClick={() => toggleWatchlist(r.slug)}
                  className="bs"
                  style={{ fontSize: 10, padding: '6px 14px', color: 'var(--gold)', borderColor: 'var(--gold)' }}
                  title="Remove from watchlist">
                  ★ Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
