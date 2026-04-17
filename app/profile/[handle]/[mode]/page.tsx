'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface ListMember {
  user_id: string
  display_name: string | null
  handle: string | null
  avatar_url: string | null
  logCount: number
}

export default function FollowListPage() {
  const params = useParams()
  const handle = params.handle as string
  const mode = params.mode as string // 'followers' | 'following'
  const { user, profile: myProfile, followingIds, toggleFollow } = useUser()

  const [loading, setLoading] = useState(true)
  const [ownerProfile, setOwnerProfile] = useState<any>(null)
  const [members, setMembers] = useState<ListMember[]>([])
  const [notFound, setNotFound] = useState(false)

  const isFollowers = mode === 'followers'
  const title = isFollowers ? 'Followers' : 'Following'

  useEffect(() => { load() }, [handle, mode])

  async function load() {
    setLoading(true)

    // 1. Resolve the handle → user_id
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id, display_name, handle, avatar_url')
      .eq('handle', handle)
      .maybeSingle()

    if (!prof) { setNotFound(true); setLoading(false); return }
    setOwnerProfile(prof)

    // 2. Fetch the relevant user IDs from follows table
    let userIds: string[] = []
    if (isFollowers) {
      // Who follows prof?  → follower_id where following_id = prof.user_id
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', prof.user_id)
      userIds = (data || []).map((r: any) => r.follower_id)
    } else {
      // Who does prof follow?  → following_id where follower_id = prof.user_id
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', prof.user_id)
      userIds = (data || []).map((r: any) => r.following_id)
    }

    if (!userIds.length) { setMembers([]); setLoading(false); return }

    // 3. Fetch profiles for those IDs
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, handle, avatar_url')
      .in('user_id', userIds)

    if (!profiles?.length) { setMembers([]); setLoading(false); return }

    // 4. Fetch log counts for each member
    const { data: logRows } = await supabase
      .from('race_logs')
      .select('user_id')
      .in('user_id', userIds)

    const logCounts: Record<string, number> = {}
    ;(logRows || []).forEach((r: any) => {
      logCounts[r.user_id] = (logCounts[r.user_id] || 0) + 1
    })

    const list: ListMember[] = profiles.map((p: any) => ({
      ...p,
      logCount: logCounts[p.user_id] || 0,
    }))
    // Sort by log count desc
    list.sort((a, b) => b.logCount - a.logCount)

    setMembers(list)
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  if (notFound) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      User not found.
      <div style={{ marginTop: 12 }}>
        <Link href="/members" className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back to Members</Link>
      </div>
    </div>
  )

  const ownerInitials = (ownerProfile?.display_name || '?')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link
          href={`/profile/${handle}`}
          className="bs"
          style={{ textDecoration: 'none', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}
        >
          ← Back to Profile
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 15,
            overflow: 'hidden', flexShrink: 0,
          }}>
            {ownerProfile?.avatar_url
              ? <img src={ownerProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : ownerInitials}
          </div>
          <div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, color: 'var(--fg)' }}>
              {title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              @{ownerProfile?.handle}
            </div>
          </div>
          <div style={{
            marginLeft: 'auto',
            fontSize: 22, fontFamily: "'Bebas Neue', sans-serif",
            color: 'var(--gold)',
          }}>
            {members.length}
          </div>
        </div>
      </div>

      {/* List */}
      {members.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
          {isFollowers
            ? 'No followers yet.'
            : `@${handle} isn't following anyone yet.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {members.map(m => {
            const ini = (m.display_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const isMe = user?.id === m.user_id
            const amFollowing = followingIds.has(m.user_id)
            const profileHref = m.handle ? `/profile/${m.handle}` : '#'

            return (
              <div
                key={m.user_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Link href={profileHref} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textDecoration: 'none', minWidth: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--card-bg)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 15,
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.display_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : ini}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: 'var(--fg)',
                      fontFamily: "'Bebas Neue', sans-serif",
                      letterSpacing: 0.5,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {(m.display_name || 'Cyclist').toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      @{m.handle || 'cyclist'}
                      {m.logCount > 0 && (
                        <span style={{ marginLeft: 8, color: 'var(--muted)', opacity: 0.6 }}>
                          · {m.logCount} race{m.logCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {!isMe && user && (
                  <button
                    onClick={() => toggleFollow(m.user_id)}
                    className={`follow-btn ${amFollowing ? 'following' : 'follow'}`}
                    style={{ flexShrink: 0 }}
                  >
                    {amFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
