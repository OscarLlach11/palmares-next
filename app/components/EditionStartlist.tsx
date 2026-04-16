'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Props {
  slug: string
  year: number
}

interface Rider {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c', '#00594a', '#c0392b', '#9a8430', '#4527a0', '#00838f', '#6d4c41', '#1a4db3']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

function riderInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function formatRiderName(name: string): string {
  if (!name) return ''
  return name.split(' ').map(w =>
    w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w
  ).join(' ')
}

export default function EditionStartlist({ slug, year }: Props) {
  const [open, setOpen] = useState(false)
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')

  async function toggle() {
    if (!open && !loaded) {
      setLoading(true)

      // FIX: the startlists table uses 'slug' as the race identifier column,
      // not 'race_slug'. Using the wrong column name causes a silent empty
      // result (Supabase returns [] rather than an error for unknown columns
      // in .eq() filters in some configurations).
      // Primary attempt: use 'slug' (matches the original index.html seeding).
      let { data } = await supabase
        .from('startlists')
        .select('rider_name,team_name,nationality,image_url')
        .eq('slug', slug)
        .eq('year', year)
        .order('team_name')
        .order('rider_name')

      // Fallback: if nothing came back, try 'race_slug' in case the DB was
      // seeded with that column name instead.
      if (!data || data.length === 0) {
        const fallback = await supabase
          .from('startlists')
          .select('rider_name,team_name,nationality,image_url')
          .eq('race_slug', slug)
          .eq('year', year)
          .order('team_name')
          .order('rider_name')
        data = fallback.data
      }

      setRiders(data || [])
      setLoaded(true)
      setLoading(false)
    }
    setOpen(prev => !prev)
  }

  const filtered = search
    ? riders.filter(r =>
        r.rider_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.team_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : riders

  return (
    <div className="rsp-section">
      <div className="rsp-st">Startlist</div>
      <button onClick={toggle} className="bs" style={{ width: '100%', marginBottom: open ? 12 : 0 }}>
        {loading ? 'Loading…' : open ? 'Hide Startlist ▴' : 'Show Startlist ▾'}
      </button>

      {open && (
        <>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search startlist…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '8px 12px', fontSize: 11, outline: 'none', marginBottom: 10 }}
          />

          {riders.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>No startlist data for {year}.</div>
          ) : (
            <div className="startlist-grid">
              {filtered.map(rider => {
                const col = riderColor(rider.rider_name)
                const ini = riderInitials(rider.rider_name)
                const hasImg = rider.image_url && rider.image_url !== 'none'
                return (
                  <Link
                    key={rider.rider_name}
                    href={`/riders/${encodeURIComponent(rider.rider_name)}`}
                    className="startlist-rider-card"
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      {hasImg ? (
                        <img
                          src={rider.image_url!}
                          className="startlist-rider-photo"
                          alt={formatRiderName(rider.rider_name)}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="startlist-rider-photo-placeholder" style={{ background: col, color: '#fff' }}>
                          {ini}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="startlist-rider-name">{formatRiderName(rider.rider_name)}</div>
                      <div className="startlist-rider-team">{rider.team_name || ''}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
