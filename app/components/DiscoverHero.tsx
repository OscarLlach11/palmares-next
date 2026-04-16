'use client'
import { useEffect, useState, useRef } from 'react'
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

// ─── Cache helpers ────────────────────────────────────────────────────────────
// Feed items are cached in localStorage so returning users see their feed
// instantly on page load without waiting for any network round-trips.

const CACHE_KEY = 'palmares-feed-v1'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes — stale feed still shows, just refreshes silently

type CacheEntry = { uid: string; items: FeedItem[]; ts: number }

function readCache(uid: string): FeedItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    // Only use cache if it belongs to this user and isn't too stale
    if (entry.uid !== uid) return null
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null
    return entry.items
  } catch {
    return null
  }
}

function writeCache(uid: string, items: FeedItem[]) {
  try {
    const entry: CacheEntry = { uid, items, ts: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // localStorage might be unavailable (private browsing, storage full) — ignore
  }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

// ─── Star display ─────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiscoverHero({ globalLogCount, globalRatingCount, raceCount }: Props) {
  const { user, logs, followingIds } = useUser()
  const [feed, setFeed] = useState<FeedItem[]>([])
  // Track whether the live fetch has completed so we can show a subtle
  // "refreshing" indicator without hiding the cached content
  const [refreshing, setRefreshing] = useState(false)
  const fetchedForUid = useRef<string | null>(null)

  const userLogs = Object.values(logs).flat()
  const userLogCount = userLogs.length
  const userRatingCount = userLogs.filter(l => l.rating && l.rating > 0).length

  const displayLogCount = user ? userLogCount : globalLogCount
  const displayRatingCount = user ? userRatingCount : globalRatingCount

  // ── OPTION 1: Kick off feed fetch immediately on mount, without waiting
  // for UserContext to resolve. We call getSession() ourselves — it hits the
  // same in-memory Supabase auth state and typically resolves in <5ms if the
  // user is already signed in. This runs in parallel with loadUserData() in
  // UserContext instead of waiting for it to complete first.
  //
  // ── OPTION 3: Before the network fetch returns, immediately show the
  // cached feed from the previous session (if it exists and belongs to
  // this user). The user sees content instantly, then the feed silently
  // updates once the fresh data arrives.
  useEffect(() => {
    let cancelled = false

    async function init() {
      // Resolve the current user as fast as possible — don't wait for context
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid || cancelled) {
        // Not logged in — clear any stale cache from a previous session
        clearCache()
        return
      }

      // Show cached feed instantly while the live fetch runs in the background
      const cached = readCache(uid)
      if (cached && cached.length > 0 && !cancelled) {
        setFeed(cached)
      }

      // Avoid re-fetching if we already have fresh data for this uid
      // (e.g. navigating back to the home page within the same session)
      if (fetchedForUid.current === uid) return
      fetchedForUid.current = uid

      setRefreshing(true)
      await loadFeed(uid, cancelled)
      if (!cancelled) setRefreshing(false)
    }

    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch the feed when the user follows/unfollows someone so the feed
  // updates immediately. We don't need to re-check getSession here because
  // we already have the uid from the context at this point.
  useEffect(() => {
    if (!user) return
    // Only re-fetch if the initial fetch has already run for this user
    // (avoids a double-fetch on first login)
    if (fetchedForUid.current !== user.id) return
    loadFeed(user.id, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followingIds.size])

  async function loadFeed(uid: string, cancelled: boolean | false) {
    // Step 1: who does this user follow?
    const { data: followData } = await supabase
      .from('follows').select('following_id').eq('follower_id', uid)

    if (cancelled) return

    if (!followData?.length) {
      setFeed([])
      clearCache()
      return
    }
    const ids = followData.map((f: any) => f.following_id)

    // Step 2: race logs + stage logs in parallel
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

    if (cancelled) return

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

    // Step 3: merge + sort + slice
    const merged = ([...raceLogs, ...stageLogs] as FeedItem[])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)

    if (!merged.length) {
      setFeed([])
      clearCache()
      return
    }

    // Step 4: profiles + race metadata in parallel
    const userIds = [...new Set(merged.map(f => f.user_id))]
    const slugs = [...new Set(merged.map(f => f.slug))]

    const [profileRes, raceRes] = await Promise.all([
      supabase.from('profiles').select('user_id,display_name,handle,avatar_url').in('user_id', userIds),
      supabase.from('races').select('slug,race_name,gradient,logo_url').in('slug', slugs),
    ])

    if (cancelled) return

    const profileMap: Record<string, any> = {}
    ;(profileRes.data || []).forEach((p: any) => { profileMap[p.user_id] = p })
    const raceMap: Record<string, any> = {}
    ;(raceRes.data || []).forEach((r: any) => { raceMap[r.slug] = r })

    const hydrated = merged.map(f => ({
      ...f,
      profiles: profileMap[f.user_id] || null,
      race: raceMap[f.slug] || null,
    }))

    setFeed(hydrated)
    // Persist for the next page load so returning users see content instantly
    writeCache(uid, hydrated)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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
          <div style={{
            fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--muted)', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            Following — Recent Logs
            {/* Subtle pulse indicator while the background refresh runs.
                Only visible for a moment — disappears once fresh data arrives. */}
            {refreshing && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--gold)', opacity: 0.5,
                animation: 'pulse 1.2s ease-in-out infinite',
                display: 'inline-block', flexShrink: 0,
              }} />
            )}
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
