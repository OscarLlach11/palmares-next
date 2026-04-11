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
  slug: string
  year: number
  rating: number | null
  created_at: string
  profiles: { display_name: string; handle: string; avatar_url: string | null } | null
  race: { race_name: string; gradient: string; logo_url: string | null } | null
}

export default function DiscoverHero({ globalLogCount, globalRatingCount, raceCount }: Props) {
  const { user, logs, followingIds } = useUser()
  const [feed, setFeed] = useState<FeedItem[]>([])

  // User-specific stats derived from context
  const userLogs = Object.values(logs).flat()
  const userLogCount = userLogs.length
  const userRatingCount = userLogs.filter(l => l.rating && l.rating > 0).length

  const displayLogCount = user ? userLogCount : globalLogCount
  const displayRatingCount = user ? userRatingCount : globalRatingCount

  const followingCount = followingIds.size

  useEffect(() => {
    if (!user) return
    loadFeed(user.id)
  }, [user?.id, followingCount])

  async function loadFeed(uid: string) {
    const { data: followData } = await supabase
      .from('follows').select('following_id').eq('follower_id', uid)
    if (!followData?.length) return

    const ids = followData.map((f: any) => f.following_id)
    const { data: feedData } = await supabase
      .from('race_logs')
      .select('id,slug,year,rating,created_at,profiles(display_name,handle,avatar_url)')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!feedData?.length) return

    const slugs = [...new Set(feedData.map((f: any) => f.slug))]
    const { data: raceData } = await supabase
      .from('races').select('slug,race_name,gradient,logo_url').in('slug', slugs)
    const raceMap: Record<string, any> = {}
    ;(raceData || []).forEach((r: any) => { raceMap[r.slug] = r })

    setFeed(feedData.map((f: any) => ({ ...f, race: raceMap[f.slug] || null })))
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
              return (
                <Link key={item.id} href={`/races/${item.slug}/${item.year}`} className="feed-item" style={{ textDecoration: 'none' }}>
                  <div className="feed-poster" style={{ background: item.race?.gradient || 'var(--border)' }}>
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
                    <div style={{ position: 'absolute', bottom: 6, left: 8, fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, color: 'var(--gold)' }}>
                      {item.year}
                    </div>
                  </div>
                  <div className="feed-user">
                    <div className="feed-avatar">
                      {p?.avatar_url
                        ? <img src={p.avatar_url} alt={p.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : ini}
                    </div>
                    <div className="feed-username">@{p?.handle || 'cyclist'}</div>
                  </div>
                  {item.rating && (
                    <div className="feed-stars" style={{ fontSize: 11, color: 'var(--gold)', marginTop: 3 }}>★ {item.rating}</div>
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
