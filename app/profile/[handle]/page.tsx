'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface Member {
  user_id: string
  display_name: string | null
  handle: string | null
  avatar_url: string | null
  fav_riders: any[]
  followerCount: number
  ridersWithImages?: { name: string; image_url: string | null }[]
}

function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c', '#00594a', '#c0392b', '#9a8430', '#4527a0', '#00838f', '#6d4c41', '#1a4db3']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

function riderInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function MembersPage() {
  const { user, followingIds, toggleFollow } = useUser()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Member[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    const [{ data: profiles }, { data: followCounts }] = await Promise.all([
      supabase.from('profiles').select('user_id,display_name,handle,avatar_url,fav_riders').not('display_name', 'is', null).limit(20),
      supabase.from('follows').select('following_id').limit(5000),
    ])
    if (!profiles?.length) { setLoading(false); return }

    const counts: Record<string, number> = {}
    ;(followCounts || []).forEach((r: any) => { counts[r.following_id] = (counts[r.following_id] || 0) + 1 })

    const sorted = profiles
      .map((p: any) => ({ ...p, followerCount: counts[p.user_id] || 0 }))
      .sort((a: any, b: any) => b.followerCount - a.followerCount)
      .slice(0, 12)

    const enriched = await enrichWithRiderImages(sorted)
    setMembers(enriched)
    setLoading(false)
  }

  async function enrichWithRiderImages(members: any[]): Promise<Member[]> {
    const getRiderName = (r: any) => typeof r === 'object' ? (r?.name || '') : (r || '')
    const allNames = [...new Set(members.flatMap((m: any) => (m.fav_riders || []).map(getRiderName).filter(Boolean)))]
    if (!allNames.length) return members.map((m: any) => ({ ...m, ridersWithImages: [] }))

    const { data: rows } = await supabase.from('startlists')
      .select('rider_name,image_url,year').in('rider_name', allNames)
      .order('year', { ascending: false }).limit(500)

    const imgMap: Record<string, string | null> = {}
    ;(rows || []).forEach((r: any) => {
      const key = r.rider_name.toLowerCase()
      if (!imgMap[key] || (r.image_url && r.image_url !== 'none')) imgMap[key] = r.image_url
    })

    return members.map((m: any) => ({
      ...m,
      ridersWithImages: (m.fav_riders || []).map(getRiderName).filter(Boolean).map((name: string) => ({
        name,
        image_url: imgMap[name.toLowerCase()] || null,
      }))
    }))
  }

  async function executeSearch() {
    if (!searchQ.trim()) { setSearchResults(null); return }
    setSearching(true)
    const [byName, byHandle] = await Promise.all([
      supabase.from('profiles').select('user_id,display_name,handle,avatar_url').ilike('display_name', `%${searchQ}%`).limit(20),
      supabase.from('profiles').select('user_id,display_name,handle,avatar_url').ilike('handle', `%${searchQ}%`).limit(20),
    ])
    const seen = new Set()
    const combined = [...(byName.data || []), ...(byHandle.data || [])].filter((p: any) => {
      if (seen.has(p.user_id)) return false
      seen.add(p.user_id); return true
    })
    setSearchResults(combined.map((p: any) => ({ ...p, followerCount: 0, fav_riders: [] })))
    setSearching(false)
  }

  const displayList = searchResults !== null ? searchResults : members

  return (
    <div>
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">PELOTON</div>
        <div className="eyebrow">— The Community</div>
        <h1>Find <em>fellow</em> fans.</h1>
      </div>

      {/* Search */}
      <div style={{ padding: '0 40px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); if (!e.target.value.trim()) setSearchResults(null) }}
          onKeyDown={e => { if (e.key === 'Enter') executeSearch() }}
          placeholder="Search by name or handle…"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '9px 16px', fontSize: 13, flex: 1, maxWidth: 360, outline: 'none' }}
        />
        <button onClick={executeSearch} className="bp" style={{ padding: '9px 20px', fontSize: 13 }}>Search</button>
        {searchResults !== null && (
          <button onClick={() => { setSearchResults(null); setSearchQ('') }} className="bs" style={{ fontSize: 10 }}>Clear</button>
        )}
      </div>

      <div style={{ padding: '28px 40px 0' }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 28 }}>
          {searchResults !== null ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}` : 'Popular Members'}
        </div>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 24 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="member-card" style={{ pointerEvents: 'none' }}>
                <div className="skeleton" style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto 14px' }} />
                <div className="skeleton" style={{ width: '70%', height: 14, margin: '0 auto 8px', borderRadius: 3 }} />
                <div className="skeleton" style={{ width: '50%', height: 10, margin: '0 auto 18px', borderRadius: 3 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && displayList.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No members found.</div>
        )}

        {/* Search results — list view */}
        {searchResults !== null && (
          <div>
            {searching && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Searching…</div>}
            {searchResults.map(m => {
              const ini = (m.display_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              const isFollowing = followingIds.has(m.user_id)
              const isMe = user?.id === m.user_id
              return (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => window.location.href = `/profile/${m.handle}`}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
                    {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.display_name || 'Cyclist'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{m.handle || 'cyclist'}</div>
                  </div>
                  {!isMe && user && (
                    <button onClick={e => { e.stopPropagation(); toggleFollow(m.user_id) }}
                      className={`follow-btn ${isFollowing ? 'following' : 'follow'}`}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Popular members — card grid */}
        {searchResults === null && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 24, paddingBottom: 40 }}>
            {members.map(m => {
              const ini = (m.display_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              const isFollowing = followingIds.has(m.user_id)
              const isMe = user?.id === m.user_id
              const riders = (m.ridersWithImages || []).slice(0, 4)

              return (
                <div key={m.user_id} className="member-card" onClick={() => window.location.href = `/profile/${m.handle}`} style={{ cursor: 'pointer' }}>
                  <div className="member-avatar-lg" onClick={e => { e.stopPropagation(); window.location.href = `/profile/${m.handle}` }}>
                    {m.avatar_url ? <img src={m.avatar_url} alt={m.display_name || ''} /> : ini}
                  </div>
                  <div className="member-name" onClick={e => { e.stopPropagation(); window.location.href = `/profile/${m.handle}` }}>
                    {(m.display_name || 'Cyclist').toUpperCase()}
                  </div>
                  <div className="member-handle">@{m.handle || 'cyclist'}</div>
                  {m.followerCount > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>
                      {m.followerCount} follower{m.followerCount !== 1 ? 's' : ''}
                    </div>
                  )}

                  {!isMe && user ? (
                    <button onClick={e => { e.stopPropagation(); toggleFollow(m.user_id) }}
                      className={`follow-btn ${isFollowing ? 'following' : 'follow'}`}
                      style={{ width: '100%', marginBottom: 14 }}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  ) : <div style={{ height: 30, marginBottom: 14 }} />}

                  <div className="member-fav-riders">
                    {riders.map(r => {
                      const col = riderColor(r.name)
                      const ini2 = riderInitials(r.name)
                      return (
                        <div key={r.name} className="member-rider-slot" title={r.name}
                          onClick={e => { e.stopPropagation(); window.location.href = `/riders/${encodeURIComponent(r.name)}` }}>
                          {r.image_url && r.image_url !== 'none'
                            ? <img src={r.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : <div className="member-rider-initials" style={{ background: col }}>{ini2}</div>}
                        </div>
                      )
                    })}
                    {[...Array(Math.max(0, 4 - riders.length))].map((_, i) => (
                      <div key={i} className="member-rider-slot" style={{ background: 'var(--border)', opacity: 0.3 }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
