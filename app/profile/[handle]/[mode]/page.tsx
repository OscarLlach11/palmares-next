'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface FollowUser {
  user_id: string
  display_name: string | null
  handle: string | null
  avatar_url: string | null
}

export default function FollowersPage() {
  const params = useParams()
  const router = useRouter()
  const { user, followingIds, toggleFollow } = useUser()
  const handle = params.handle as string
  const mode = params.mode as string // 'followers' | 'following'

  const [loading, setLoading] = useState(true)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [list, setList] = useState<FollowUser[]>([])
  const [displayName, setDisplayName] = useState('')

  useEffect(() => { load() }, [handle, mode])

  async function load() {
    setLoading(true)

    // Get profile by handle
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id,display_name')
      .eq('handle', handle)
      .maybeSingle()

    if (!prof) { setLoading(false); return }
    setProfileUserId(prof.user_id)
    setDisplayName(prof.display_name || handle)

    let userIds: string[] = []

    if (mode === 'followers') {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', prof.user_id)
      userIds = (data || []).map((r: any) => r.follower_id)
    } else {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', prof.user_id)
      userIds = (data || []).map((r: any) => r.following_id)
    }

    if (!userIds.length) { setList([]); setLoading(false); return }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id,display_name,handle,avatar_url')
      .in('user_id', userIds)

    setList(profiles || [])
    setLoading(false)
  }

  const title = mode === 'followers' ? 'Followers' : 'Following'

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: 'var(--gold)' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>· {displayName}</div>
      </div>

      {loading && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading…</div>}

      {!loading && list.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </div>
      )}

      {list.map(u => {
        const ini = (u.display_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
        const isFollowing = followingIds.has(u.user_id)
        const isMe = user?.id === u.user_id
        return (
          <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <Link href={`/profile/${u.handle}`} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, textDecoration: 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt={u.display_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : ini}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{u.display_name || 'Cyclist'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{u.handle || 'cyclist'}</div>
              </div>
            </Link>
            {!isMe && user && (
              <button
                onClick={() => toggleFollow(u.user_id)}
                className={`follow-btn ${isFollowing ? 'following' : 'follow'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
