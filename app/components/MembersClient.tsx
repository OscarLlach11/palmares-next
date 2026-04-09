'use client'
import { useState } from 'react'

interface RiderWithImage { name: string; image_url: string | null }
interface Member {
  user_id: string
  display_name: string | null
  handle: string | null
  avatar_url: string | null
  followerCount: number
  ridersWithImages: RiderWithImage[]
}

const PALETTE = ['#c0392b','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#8bc34a']
function riderColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}
function riderInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function MembersClient({ initialMembers }: { initialMembers: Member[] }) {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Member[]>([])
  const [searching, setSearching] = useState(false)

  async function doSearch() {
    const q = search.trim()
    if (!q) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const res = await fetch(`/api/members/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data)
    setSearching(false)
  }

  const displayMembers = search.trim() && searchResults.length > 0 ? searchResults : initialMembers

  return (
    <div>
      {/* Search */}
      <div style={{ padding: '0 40px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Search by name or handle…"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--white)', padding: '9px 16px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, flex: 1, maxWidth: 360 }}
        />
        <button onClick={doSearch} className="bp" style={{ padding: '9px 20px' }}>
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {/* Members grid */}
      <div style={{ padding: '28px 40px 0' }}>
        <div style={{ fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 28 }}>
          {search.trim() && searchResults.length > 0 ? `${searchResults.length} results` : 'Popular This Week'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 24 }}>
          {displayMembers.map(m => <MemberCard key={m.user_id} member={m} />)}
        </div>
      </div>
    </div>
  )
}

function MemberCard({ member: m }: { member: Member }) {
  const ini = (m.display_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <a href={`/users/${m.user_id}`} className="member-card" style={{ textDecoration: 'none', display: 'block' }}>
      <div className="member-avatar-lg">
        {m.avatar_url
          ? <img src={m.avatar_url} alt={m.display_name || ''} />
          : ini
        }
      </div>
      <div className="member-name">{(m.display_name || 'Cyclist').toUpperCase()}</div>
      <div className="member-handle">@{m.handle || 'cyclist'}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>
        {m.followerCount} follower{m.followerCount !== 1 ? 's' : ''}
      </div>
      <div className="member-fav-riders">
        {m.ridersWithImages.slice(0, 4).map(r => {
          const col = riderColor(r.name)
          const ini2 = riderInitials(r.name)
          return (
            <div key={r.name} className="member-rider-slot" title={r.name}>
              {r.image_url
                ? <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                : <div className="member-rider-initials" style={{ background: col }}>{ini2}</div>
              }
            </div>
          )
        })}
        {Array(Math.max(0, 4 - m.ridersWithImages.length)).fill(null).map((_, i) => (
          <div key={i} className="member-rider-slot" style={{ background: 'var(--border)', opacity: .3 }} />
        ))}
      </div>
    </a>
  )
}
