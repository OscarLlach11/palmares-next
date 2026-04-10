'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, RaceLog } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserContextValue {
  // Auth
  user: any | null
  profile: Profile | null
  loading: boolean

  // Race logs — keyed by slug, each entry is array of watches
  logs: Record<string, RaceLog[]>
  // Watchlist slugs
  watchlist: string[]
  // Following user IDs
  followingIds: Set<string>

  // Actions
  refreshLogs: () => Promise<void>
  addLog: (log: RaceLog) => void
  updateLog: (log: RaceLog) => void
  removeLog: (id: string, slug: string) => void
  toggleWatchlist: (slug: string) => Promise<void>
  toggleFollow: (targetUserId: string) => Promise<void>
  isLogged: (slug: string) => boolean
  getLog: (slug: string) => RaceLog[]
  getBestRating: (slug: string) => number
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<Record<string, RaceLog[]>>({})
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const loadedRef = useRef(false)

  // ── Load all user data ─────────────────────────────────────────────────────
  const loadUserData = useCallback(async (uid: string) => {
    const [profRes, logsRes, wlRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('race_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('watchlist').select('slug').eq('user_id', uid),
      supabase.from('follows').select('following_id').eq('follower_id', uid),
    ])

    if (profRes.data) setProfile(profRes.data as Profile)

    // Index logs by slug
    const logMap: Record<string, RaceLog[]> = {}
    ;(logsRes.data || []).forEach((l: RaceLog) => {
      if (!logMap[l.slug]) logMap[l.slug] = []
      logMap[l.slug].push(l)
    })
    setLogs(logMap)

    setWatchlist((wlRes.data || []).map((r: any) => r.slug))
    setFollowingIds(new Set((followRes.data || []).map((r: any) => r.following_id)))
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
    if (data) setProfile(data as Profile)
  }, [user])

  const refreshLogs = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('race_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    const logMap: Record<string, RaceLog[]> = {}
    ;(data || []).forEach((l: RaceLog) => {
      if (!logMap[l.slug]) logMap[l.slug] = []
      logMap[l.slug].push(l)
    })
    setLogs(logMap)
  }, [user])

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u && !loadedRef.current) {
        loadedRef.current = true
        await loadUserData(u.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (event === 'SIGNED_IN' && u) {
        loadedRef.current = true
        await loadUserData(u.id)
      } else if (event === 'SIGNED_OUT') {
        loadedRef.current = false
        setProfile(null)
        setLogs({})
        setWatchlist([])
        setFollowingIds(new Set())
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadUserData])

  // ── Log helpers ────────────────────────────────────────────────────────────
  const addLog = useCallback((log: RaceLog) => {
    setLogs(prev => ({
      ...prev,
      [log.slug]: [log, ...(prev[log.slug] || [])],
    }))
  }, [])

  const updateLog = useCallback((log: RaceLog) => {
    setLogs(prev => ({
      ...prev,
      [log.slug]: (prev[log.slug] || []).map(l => l.id === log.id ? log : l),
    }))
  }, [])

  const removeLog = useCallback((id: string, slug: string) => {
    setLogs(prev => {
      const updated = (prev[slug] || []).filter(l => l.id !== id)
      if (!updated.length) {
        const next = { ...prev }
        delete next[slug]
        return next
      }
      return { ...prev, [slug]: updated }
    })
  }, [])

  // ── Watchlist ──────────────────────────────────────────────────────────────
  const toggleWatchlist = useCallback(async (slug: string) => {
    if (!user) return
    const inWL = watchlist.includes(slug)
    if (inWL) {
      setWatchlist(prev => prev.filter(s => s !== slug))
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('slug', slug)
    } else {
      setWatchlist(prev => [...prev, slug])
      await supabase.from('watchlist').upsert({ user_id: user.id, slug })
    }
  }, [user, watchlist])

  // ── Follow ─────────────────────────────────────────────────────────────────
  const toggleFollow = useCallback(async (targetUserId: string) => {
    if (!user) return
    const isFollowing = followingIds.has(targetUserId)
    if (isFollowing) {
      setFollowingIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next })
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId)
    } else {
      setFollowingIds(prev => new Set([...prev, targetUserId]))
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetUserId })
    }
  }, [user, followingIds])

  // ── Derived helpers ────────────────────────────────────────────────────────
  const isLogged = useCallback((slug: string) => !!(logs[slug]?.length), [logs])
  const getLog = useCallback((slug: string) => logs[slug] || [], [logs])
  const getBestRating = useCallback((slug: string) => {
    const entries = logs[slug] || []
    return entries.reduce((max, l) => Math.max(max, l.rating || 0), 0)
  }, [logs])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <UserContext.Provider value={{
      user, profile, loading,
      logs, watchlist, followingIds,
      refreshLogs, addLog, updateLog, removeLog,
      toggleWatchlist, toggleFollow,
      isLogged, getLog, getBestRating,
      refreshProfile, signOut,
    }}>
      {children}
    </UserContext.Provider>
  )
}
