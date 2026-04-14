'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/app/context/UserContext'
import { supabase } from '@/lib/supabase'

interface Props {
  globalLogCount: number
  globalRatingCount: number
  raceCount: number
}

type FeedItem = {
  id: string
  type: 'race' | 'stage'
  slug: string
  year: number
  stage_num: number | null
  rating: number | null
  review: string | null
  created_at: string
  user_id: string
  profiles: { display_name: string; handle: string; avatar_url: string | null } | null
  race: { race_name: string; gradient: string; logo_url: string | null } | null
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => {
        const full = rating >= s
        const half = !full && rating >= s - 0.5
        return (
          <div key={s} style={{ position: 'relative', width: 11, height: 11 }}>
            <svg width={11} height={11} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
              <path fill="rgba(255,255,255,.15)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {half && (
              <svg width={11} height={11} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0, clipPath: 'inset(0 50% 0 0)' }}>
                <path fill="var(--gold)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {full && (
              <svg width={11} height={11} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
                <path fill="var(--gold)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
          </div>
        )
      })}
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, color: 'var(--gold)', marginLeft: 2, lineHeight: 1 }}>
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DiscoverHero({ globalLogCount, globalRatingCount, raceCount }: Props) {
  const { user, logs, followingIds } = useUser()
  const [feed, setFeed] = useState<FeedItem[]>([])

  const userLogs = Object.values(logs).flat()
  const userLogCount = userLogs.length
  const userRatingCount = userLogs.filter(l => l.rating && l.rating > 0).length

  const displayLogCount = user ? userLogCount : globalLogCount
  const displayRatingCount = user ? userRatingCount : globalRatingCount

  useEffect(() => {
    if (!user) return
    loadFeed(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, followingIds])

  async function loadFeed(uid: string) {
    // Step 1: get who we follow directly from DB (don't rely on context timing)
    const { data: followData } = await supabase
      .from('follows').select('following_id').eq('follower_id', uid)
    if (!followData?.length) {
      setFeed([])
      return
    }
    const ids = followData.map((f: any) => f.following_id)

    // Step 2: fetch race logs and stage logs — select user_id explicitly, no FK join
    const [raceLogsRes, stageLogsRes] = await Promise.all([
      supabase
        .from('race_logs')
        .select('id,slug,year,rating,review,created_at,user_id')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('stage_logs')
        .select('id,race_slug,year,stage_num,rating,review,created_at,user_id')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const raceLogs = (raceLogsRes.data || []).map((f: any) => ({
      id: f.id, type: 'race' as const,
      slug: f.slug, year: f.year, stage_num: null,
      rating: f.rating, review: f.review,
      created_at: f.created_at, user_id: f.user_id,
      profiles: null, race: null,
    }))

    const stageLogs = (stageLogsRes.data || []).map((f: any) => ({
      id: f.id, type: 'stage' as const,
      slug: f.race_slug, year: f.year, stage_num: f.stage_num,
      rating: f.rating, review: f.review,
      created_at: f.created_at, user_id: f.user_id,
      profiles: null, race: null,
    }))

    // Step 3: merge, sort, take top 20
    const merged = ([...raceLogs, ...stageLogs] as FeedItem[])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)

    if (!merged.length) { setFeed([]); return }

    // Step 4: fetch profiles for all unique user_ids
    const userIds = [...new Set(merged.map(f => f.user_id))]
    const { data: profileData } = await supabase
      .from('profiles').select('user_id,display_name,handle,avatar_url').in('user_id', userIds)
    const profileMap: Record<string, any> = {}
    ;(profileData || []).forEach((p: any) => { profileMap[p.user_id] = p })

    // Step 5: fetch race metadata for all unique slugs
    const slugs = [...new Set(merged.map(f => f.slug))]
    const { data: raceData } = await supabase
      .from('races').select('slug,race_name,gradient,logo_url').in('slug', slugs)
    const raceMap: Record<string, any> = {}
    ;(raceData || []).forEach((r: any) => { raceMap[r.slug] = r })

    setFeed(merged.map(f => ({
      ...f,
      profiles: profileMap[f.user_id] || null,
      race: raceMap[f.slug] || null,
    })))
  }

  return (
    <>
      <div className="hero">
        <div className="hero-bg">VÉLO</div>
        <div className="eyebrow">— The Cycling Race Diary</div>
        <h1>Every <em>édition.</em> Logged.</h1>
        <p className="hero-sub">Rate stage by stage. Track every breakaway since 1980.</p>
        <div className="hstats">
          <div>
            <div className="hstat-n">{displayLogCount.toLocaleString()}</div>
            <div className="hstat-l">Races Logged</div>
          </div>
          <div>
            <div className="hstat-n">{displayRatingCount.toLocaleString()}</div>
            <div className="hstat-l">Ratings Given</div>
          </div>
          <div>
            <div className="hstat-n">{raceCount}</div>
            <div className="hstat-l">Races in DB</div>
          </div>
        </div>
      </div>

      {feed.length > 0 && (
        <div style={{ padding: '16px 40px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
            Following — Recent Logs
          </div>
          <div className="feed-grid">
            {feed.map(item => {
              const p = item.profiles as any
              const ini = (p?.display_name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

              const href = item.type === 'stage'
                ? `/races/${item.slug}/${item.year}/stages/${item.stage_num}`
                : item.review?.trim() && p?.handle
                  ? `/review/${p.handle}/${item.slug}/${item.year}`
                  : `/races/${item.slug}/${item.year}`

              const yearLabel = item.type === 'stage' && item.stage_num != null
                ? `${item.year} · S${item.stage_num}`
                : String(item.year)

              return (
                <Link key={`${item.type}-${item.id}`} href={href} className="feed-item" style={{ textDecoration: 'none' }}>
                  <div className="feed-poster" style={{ background: item.race?.gradient || 'var(--border)' }}>
                    {item.type === 'stage' && (
                      <div className="feed-poster-stage">Stage {item.stage_num}</div>
                    )}
                    {item.race?.logo_url ? (
                      <div className="feed-poster-bg">
                        <img src={item.race.logo_url} alt={item.race.race_name}
                          style={{ maxWidth: '80%', maxHeight: '70%', objectFit: 'contain' }} />
                      </div>
                    ) : (
                      <div className="feed-poster-bg">
                        <div className="feed-poster-title">{item.race?.race_name || item.slug}</div>
                      </div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 6, left: 8,
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 12,
                      letterSpacing: 1.5, color: 'var(--gold)',
                    }}>
                      {yearLabel}
                    </div>
                  </div>

                  <div className="feed-user" style={{ marginTop: 7 }}>
                    <div className="feed-avatar">
                      {p?.avatar_url
                        ? <img src={p.avatar_url} alt={p?.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : ini}
                    </div>
                    <div className="feed-username">@{p?.handle || 'cyclist'}</div>
                  </div>

                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, letterSpacing: 0.5 }}>
                    {fmtDate(item.created_at)}
                  </div>

                  {item.rating != null && item.rating > 0 && (
                    <div className="feed-stars" style={{ marginTop: 4 }}>
                      <StarDisplay rating={item.rating} />
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
