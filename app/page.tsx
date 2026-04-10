'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Race = {
  slug: string; race_name: string; race_type: string; first_year: number
  tier: string; country: string; flag: string; distance: number | null
  gradient: string; subgenres: string[]; logo_url: string | null
}
type FeedItem = {
  id: string; slug: string; year: number; rating: number | null
  stage_num: number | null; created_at: string
  profiles: { display_name: string; handle: string; avatar_url: string | null } | null
  race?: Race
}

const SG_LABELS: Record<string, string> = {
  cobbled: 'Cobbled', gravel: 'Gravel', mountain: 'Mountain', sprint: 'Sprinters',
  classics: 'Classics', ardennes: 'Ardennes', monument: 'Monument', gc: 'Grand Tour',
  'stage-race': 'Stage Race', tt: 'Time Trial',
}
const SG_CLASS: Record<string, string> = {
  cobbled: 'sg-cobbled', gravel: 'sg-gravel', mountain: 'sg-mountain', sprint: 'sg-sprint',
  classics: 'sg-classics', ardennes: 'sg-ardennes', monument: 'sg-classics', gc: 'sg-stage',
  'stage-race': 'sg-stage', tt: 'sg-tt',
}

export default function DiscoverPage() {
  const [user, setUser] = useState<any>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [userLogCount, setUserLogCount] = useState(0)
  const [userRatingCount, setUserRatingCount] = useState(0)
  const [globalLogCount, setGlobalLogCount] = useState(0)
  const [globalRatingCount, setGlobalRatingCount] = useState(0)
  const [raceCount, setRaceCount] = useState(0)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [userLogSlugs, setUserLogSlugs] = useState<Set<string>>(new Set())

  // Filter state
  const [tier, setTier] = useState('all')
  const [tab, setTab] = useState('all')
  const [filterShow, setFilterShow] = useState('all')
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    loadRaces()
    loadGlobalStats()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        loadUserStats(data.session.user.id)
        loadFollowingFeed(data.session.user.id)
      }
    })
  }, [])

  async function loadRaces() {
    const { data } = await supabase.from('races')
      .select('slug,race_name,race_type,first_year,tier,country,flag,distance,gradient,subgenres,logo_url')
      .order('race_name')
    setRaces((data || []) as Race[])
    setRaceCount((data || []).length)
  }

  async function loadGlobalStats() {
    const { data } = await supabase.from('race_logs').select('id,rating')
    setGlobalLogCount((data || []).length)
    setGlobalRatingCount((data || []).filter((l: any) => l.rating > 0).length)
  }

  async function loadUserStats(uid: string) {
    const { data } = await supabase.from('race_logs').select('id,rating').eq('user_id', uid)
    const logs = data || []
    setUserLogCount(logs.length)
    setUserRatingCount(logs.filter((l: any) => l.rating > 0).length)
    setUserLogSlugs(new Set((data || []).map((l: any) => l.slug)))
  }

  async function loadFollowingFeed(uid: string) {
    // Get following IDs
    const { data: followData } = await supabase.from('follows').select('following_id').eq('follower_id', uid)
    if (!followData?.length) return
    const ids = followData.map((f: any) => f.following_id)

    // Get their recent logs
    const { data: feedData } = await supabase
      .from('race_logs')
      .select('id,slug,year,rating,stage_num,created_at,user_id,profiles(display_name,handle,avatar_url)')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!feedData?.length) return

    // Attach race data
    const slugs = [...new Set(feedData.map((f: any) => f.slug))]
    const { data: raceData } = await supabase.from('races').select('slug,race_name,gradient,logo_url').in('slug', slugs)
    const raceMap: Record<string, any> = {}
    ;(raceData || []).forEach((r: any) => { raceMap[r.slug] = r })
    setFeedItems(feedData.map((f: any) => ({ ...f, race: raceMap[f.slug] })))
  }

  // Filtered + sorted races
  const RACE_TYPE_TABS: Record<string, string[]> = {
    all: [],
    wt: [],
    pro: [],
    champ: [],
  }
  const TYPE_LABELS: Record<string, string> = {
    'Grand Tour': 'Grand Tours',
    'Monument': 'Monuments',
    'Classic': 'Classics',
    'Stage Race': 'Stage Races',
    'One Day': 'One Day',
    'championship': 'Championships',
  }

  const isWT = (r: Race) => r.tier === 'WT'
  const isChamp = (r: Race) => r.race_type === 'championship'

  const subtabs = tab === 'all' ? [] : [tab]

  const filteredRaces = races.filter(r => {
    if (tier === 'wt' && (!isWT(r) || isChamp(r))) return false
    if (tier === 'pro' && (isWT(r) || isChamp(r))) return false
    if (tier === 'champ' && !isChamp(r)) return false
    if (tier !== 'champ' && tab !== 'all' && r.race_type !== tab) return false
    if (filterShow === 'logged' && !userLogSlugs.has(r.slug)) return false
    if (filterShow === 'unlogged' && userLogSlugs.has(r.slug)) return false
    if (searchQ && !r.race_name.toLowerCase().includes(searchQ.toLowerCase()) && !r.country.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  })

  const typeTabsForTier = tier === 'champ'
    ? []
    : [...new Set(races.filter(r => {
      if (tier === 'wt') return isWT(r) && !isChamp(r)
      if (tier === 'pro') return !isWT(r) && !isChamp(r)
      return !isChamp(r)
    }).map(r => r.race_type).filter(Boolean))]

  const displayLogCount = user ? userLogCount : globalLogCount
  const displayRatingCount = user ? userRatingCount : globalRatingCount

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <div className="hero-bg">VÉLO</div>
        <div className="eyebrow">— The Cycling Race Diary</div>
        <h1>Every <em>édition.</em> Logged.</h1>
        <p className="hero-sub">Rate stage by stage. Track every breakaway since 1980.</p>
        <div className="hstats">
          <div><div className="hstat-n">{displayLogCount.toLocaleString()}</div><div className="hstat-l">Races Logged</div></div>
          <div><div className="hstat-n">{displayRatingCount.toLocaleString()}</div><div className="hstat-l">Ratings Given</div></div>
          <div><div className="hstat-n">{raceCount}</div><div className="hstat-l">Races in DB</div></div>
        </div>
      </div>

      {/* Following feed */}
      {feedItems.length > 0 && (
        <div style={{ padding: '16px 40px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Following — Recent Logs</div>
          <div className="feed-grid">
            {feedItems.map(item => {
              const p = item.profiles
              const ini = (p?.display_name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              return (
                <Link key={item.id} href={`/races/${item.slug}/${item.year}`} className="feed-item" style={{ textDecoration: 'none' }}>
                  <div className="feed-poster" style={{ background: item.race?.gradient || 'var(--border)' }}>
                    {item.stage_num && <div className="feed-poster-stage">Stage {item.stage_num}</div>}
                    {item.race?.logo_url && (
                      <div className="feed-poster-bg">
                        <img src={item.race.logo_url} alt={item.race.race_name} style={{ maxWidth: '80%', maxHeight: '70%', objectFit: 'contain' }} />
                      </div>
                    )}
                    {!item.race?.logo_url && (
                      <div className="feed-poster-bg">
                        <div className="feed-poster-title">{item.race?.race_name || item.slug}</div>
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 6, left: 8, fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, color: 'var(--gold)' }}>{item.year}</div>
                  </div>
                  <div className="feed-user">
                    <div className="feed-avatar">
                      {p?.avatar_url ? <img src={p.avatar_url} alt={p.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini}
                    </div>
                    <div className="feed-username">@{p?.handle || 'cyclist'}</div>
                  </div>
                  {item.rating && (
                    <div className="feed-stars" style={{ fontSize: 11, color: 'var(--gold)' }}>★ {item.rating}</div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Tier tabs */}
      <div className="tier-bar">
        {[['all', 'All'], ['wt', 'WorldTour'], ['pro', 'Pro Series'], ['champ', 'Championships']].map(([v, l]) => (
          <button key={v} className={`tier-btn${tier === v ? ' active' : ''}`} onClick={() => { setTier(v); setTab('all') }}>{l}</button>
        ))}
      </div>

      {/* Type tabs */}
      {typeTabsForTier.length > 0 && (
        <div className="tabs">
          <div className={`tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>All</div>
          {typeTabsForTier.map(t => (
            <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="fbar">
        <span className="fl">Show:</span>
        {[['all', 'All'], ['logged', 'Logged'], ['unlogged', 'Unlogged']].map(([v, l]) => (
          <button key={v} className={`fb${filterShow === v ? ' active' : ''}`} onClick={() => setFilterShow(v)}>{l}</button>
        ))}
        <input
          value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Search races…"
          style={{ marginLeft: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '5px 12px', fontSize: 12, outline: 'none', width: 200 }}
        />
      </div>

      {/* Race grid */}
      <div className="main-layout">
        <div className="main-content">
          {filteredRaces.length === 0 ? (
            <div className="empty">No races match your search.</div>
          ) : (
            <div className="race-grid">
              {filteredRaces.map(r => (
                <Link key={r.slug} href={`/races/${r.slug}`} className="rc" style={{ textDecoration: 'none' }}>
                  <div className="rc-img" style={{ background: r.gradient, position: 'relative', overflow: 'hidden' }}>
                    <span className="rc-cat">{r.race_type === 'championship' ? 'CHAMPS' : r.race_type?.toUpperCase()}</span>
                    {isWT(r) && !isChamp(r) && <span className="rc-wt">WT</span>}
                    {r.logo_url && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 8px 22px' }}>
                        <img src={r.logo_url} alt={r.race_name} style={{ maxWidth: '80%', maxHeight: '70%', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>
                  <div className="rc-body">
                    <div className="rc-ctry">{r.flag} {r.country}</div>
                    <div className="rc-name">{r.race_name}</div>
                    <div className="rc-yr">Est. {r.first_year}</div>
                    {r.subgenres?.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {r.subgenres.slice(0, 2).map(sg => (
                          <span key={sg} className={`sg-badge ${SG_CLASS[sg] || ''}`}>{SG_LABELS[sg] || sg}</span>
                        ))}
                      </div>
                    )}
                    {userLogSlugs.has(r.slug) && (
                      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--gold)', letterSpacing: 1 }}>✓ Logged</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sb-title">Recent Activity</div>
          {user ? (
            <div id="sidebar-log">
              <div className="empty-log">Your recently logged races appear here.</div>
            </div>
          ) : (
            <div className="empty-log">
              <Link href="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to see your activity.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
