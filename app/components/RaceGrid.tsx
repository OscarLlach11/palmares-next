'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import type { Race } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import LogRaceModal from './LogRaceModal'
import { supabase } from '@/lib/supabase'

interface FeaturedRider {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

interface Props {
  races: Race[]
  sgLabels: Record<string, string>
  sgClass: Record<string, string>
  featuredRiders: FeaturedRider[]
}

const TIERS = [
  { key: 'all',   label: 'All' },
  { key: 'wt',    label: 'WorldTour' },
  { key: 'pro',   label: 'Pro Series' },
  { key: 'champ', label: 'Championships' },
]

// ── Championship flag + gradient lookup ───────────────────────────────────────
// Direct port of COUNTRY_CHAMP_DATA + CHAMP_CATEGORY_DATA + getChampData
// from the original index.html.

const COUNTRY_CHAMP_DATA: Record<string, { flag: string; gradient: string }> = {
  'Afghanistan':      { flag:'🇦🇫', gradient:'linear-gradient(135deg,#000000,#009a44,#000000)' },
  'Albania':          { flag:'🇦🇱', gradient:'linear-gradient(135deg,#e41e20,#000000)' },
  'Algeria':          { flag:'🇩🇿', gradient:'linear-gradient(135deg,#006233,#ffffff,#d21034)' },
  'Argentina':        { flag:'🇦🇷', gradient:'linear-gradient(135deg,#74acdf,#ffffff,#74acdf)' },
  'Armenia':          { flag:'🇦🇲', gradient:'linear-gradient(135deg,#d90012,#0033a0,#f2a800)' },
  'Australia':        { flag:'🇦🇺', gradient:'linear-gradient(135deg,#00008b,#cf142b,#ffffff)' },
  'Austria':          { flag:'🇦🇹', gradient:'linear-gradient(135deg,#ed2939,#ffffff,#ed2939)' },
  'Azerbaijan':       { flag:'🇦🇿', gradient:'linear-gradient(135deg,#0092bc,#e8192c,#00b050)' },
  'Bahrain':          { flag:'🇧🇭', gradient:'linear-gradient(135deg,#ce1126,#ffffff)' },
  'Belarus':          { flag:'🇧🇾', gradient:'linear-gradient(135deg,#cf101a,#009027,#ffffff)' },
  'Belgium':          { flag:'🇧🇪', gradient:'linear-gradient(135deg,#000000,#ffd90c,#ef3340)' },
  'Bolivia':          { flag:'🇧🇴', gradient:'linear-gradient(135deg,#d52b1e,#f4e400,#007a3d)' },
  'Bosnia':           { flag:'🇧🇦', gradient:'linear-gradient(135deg,#002395,#fecb00)' },
  'Bosnia and Herzegovina': { flag:'🇧🇦', gradient:'linear-gradient(135deg,#002395,#fecb00)' },
  'Brazil':           { flag:'🇧🇷', gradient:'linear-gradient(135deg,#009c3b,#ffdf00,#002776)' },
  'Bulgaria':         { flag:'🇧🇬', gradient:'linear-gradient(135deg,#ffffff,#00966e,#d62612)' },
  'Canada':           { flag:'🇨🇦', gradient:'linear-gradient(135deg,#ff0000,#ffffff,#ff0000)' },
  'Chile':            { flag:'🇨🇱', gradient:'linear-gradient(135deg,#d52b1e,#ffffff,#003087)' },
  'China':            { flag:'🇨🇳', gradient:'linear-gradient(135deg,#de2910,#ffde00)' },
  'Chinese Taipei':   { flag:'🇹🇼', gradient:'linear-gradient(135deg,#fe0000,#000095)' },
  'Colombia':         { flag:'🇨🇴', gradient:'linear-gradient(135deg,#fcd116,#003087,#ce1126)' },
  'Costa Rica':       { flag:'🇨🇷', gradient:'linear-gradient(135deg,#002b7f,#ffffff,#ce1126,#ffffff,#002b7f)' },
  'Croatia':          { flag:'🇭🇷', gradient:'linear-gradient(135deg,#ff0000,#ffffff,#003087)' },
  'Cuba':             { flag:'🇨🇺', gradient:'linear-gradient(135deg,#002a8f,#ffffff,#cc0001)' },
  'Cyprus':           { flag:'🇨🇾', gradient:'linear-gradient(135deg,#ffffff,#d57800)' },
  'Czech Republic':   { flag:'🇨🇿', gradient:'linear-gradient(135deg,#d7141a,#ffffff,#11457e)' },
  'Czechia':          { flag:'🇨🇿', gradient:'linear-gradient(135deg,#d7141a,#ffffff,#11457e)' },
  'Denmark':          { flag:'🇩🇰', gradient:'linear-gradient(135deg,#c60c30,#ffffff)' },
  'Ecuador':          { flag:'🇪🇨', gradient:'linear-gradient(135deg,#ffd100,#003087,#ce1126)' },
  'Egypt':            { flag:'🇪🇬', gradient:'linear-gradient(135deg,#ce1126,#ffffff,#000000)' },
  'El Salvador':      { flag:'🇸🇻', gradient:'linear-gradient(135deg,#0f47af,#ffffff,#0f47af)' },
  'Eritrea':          { flag:'🇪🇷', gradient:'linear-gradient(135deg,#4189dd,#12ad2b,#ff0000)' },
  'Estonia':          { flag:'🇪🇪', gradient:'linear-gradient(135deg,#0072ce,#000000,#ffffff)' },
  'Ethiopia':         { flag:'🇪🇹', gradient:'linear-gradient(135deg,#078930,#fcdd09,#da121a)' },
  'Finland':          { flag:'🇫🇮', gradient:'linear-gradient(135deg,#ffffff,#003580)' },
  'France':           { flag:'🇫🇷', gradient:'linear-gradient(135deg,#002395,#ffffff,#ed2939)' },
  'Georgia':          { flag:'🇬🇪', gradient:'linear-gradient(135deg,#ffffff,#ff0000)' },
  'Germany':          { flag:'🇩🇪', gradient:'linear-gradient(135deg,#000000,#dd0000,#ffce00)' },
  'Ghana':            { flag:'🇬🇭', gradient:'linear-gradient(135deg,#006b3f,#fcd116,#ce1126)' },
  'Great Britain':    { flag:'🇬🇧', gradient:'linear-gradient(135deg,#012169,#c8102e,#ffffff)' },
  'Greece':           { flag:'🇬🇷', gradient:'linear-gradient(135deg,#0d5eaf,#ffffff)' },
  'Guatemala':        { flag:'🇬🇹', gradient:'linear-gradient(135deg,#4997d0,#ffffff,#4997d0)' },
  'Hong Kong':        { flag:'🇭🇰', gradient:'linear-gradient(135deg,#de2910,#ffffff)' },
  'Hungary':          { flag:'🇭🇺', gradient:'linear-gradient(135deg,#ce2939,#ffffff,#477050)' },
  'Iceland':          { flag:'🇮🇸', gradient:'linear-gradient(135deg,#003897,#ffffff,#d72828)' },
  'India':            { flag:'🇮🇳', gradient:'linear-gradient(135deg,#ff9933,#ffffff,#138808)' },
  'Indonesia':        { flag:'🇮🇩', gradient:'linear-gradient(135deg,#ce1126,#ffffff)' },
  'Iran':             { flag:'🇮🇷', gradient:'linear-gradient(135deg,#239f40,#ffffff,#da0000)' },
  'Iraq':             { flag:'🇮🇶', gradient:'linear-gradient(135deg,#ce1126,#ffffff,#000000)' },
  'Ireland':          { flag:'🇮🇪', gradient:'linear-gradient(135deg,#169b62,#ffffff,#ff883e)' },
  'Israel':           { flag:'🇮🇱', gradient:'linear-gradient(135deg,#ffffff,#0038b8)' },
  'Italy':            { flag:'🇮🇹', gradient:'linear-gradient(135deg,#009246,#ffffff,#ce2b37)' },
  'Japan':            { flag:'🇯🇵', gradient:'linear-gradient(135deg,#ffffff,#bc002d)' },
  'Jordan':           { flag:'🇯🇴', gradient:'linear-gradient(135deg,#007a3d,#ffffff,#000000)' },
  'Kazakhstan':       { flag:'🇰🇿', gradient:'linear-gradient(135deg,#00afca,#ffd700)' },
  'Kenya':            { flag:'🇰🇪', gradient:'linear-gradient(135deg,#006600,#000000,#cc0000)' },
  'Korea':            { flag:'🇰🇷', gradient:'linear-gradient(135deg,#ffffff,#cd2e3a,#003478)' },
  'Kosovo':           { flag:'🇽🇰', gradient:'linear-gradient(135deg,#244aa5,#fcd116)' },
  'Latvia':           { flag:'🇱🇻', gradient:'linear-gradient(135deg,#9e3039,#ffffff,#9e3039)' },
  'Lebanon':          { flag:'🇱🇧', gradient:'linear-gradient(135deg,#ffffff,#ee161f)' },
  'Lithuania':        { flag:'🇱🇹', gradient:'linear-gradient(135deg,#fdb913,#006a44,#c1272d)' },
  'Luxembourg':       { flag:'🇱🇺', gradient:'linear-gradient(135deg,#ef3340,#ffffff,#00a2e1)' },
  'Malaysia':         { flag:'🇲🇾', gradient:'linear-gradient(135deg,#cc0001,#ffffff,#010082)' },
  'Mexico':           { flag:'🇲🇽', gradient:'linear-gradient(135deg,#006847,#ffffff,#ce1126)' },
  'Moldova':          { flag:'🇲🇩', gradient:'linear-gradient(135deg,#003DA5,#FFD200,#CC0000)' },
  'Montenegro':       { flag:'🇲🇪', gradient:'linear-gradient(135deg,#d4af37,#d3001c,#d4af37)' },
  'Morocco':          { flag:'🇲🇦', gradient:'linear-gradient(135deg,#c1272d,#006233)' },
  'Netherlands':      { flag:'🇳🇱', gradient:'linear-gradient(135deg,#ae1c28,#ffffff,#21468b)' },
  'New Zealand':      { flag:'🇳🇿', gradient:'linear-gradient(135deg,#00247d,#cc142b)' },
  'Nigeria':          { flag:'🇳🇬', gradient:'linear-gradient(135deg,#008751,#ffffff,#008751)' },
  'North Macedonia':  { flag:'🇲🇰', gradient:'linear-gradient(135deg,#ce2028,#f9d616)' },
  'Norway':           { flag:'🇳🇴', gradient:'linear-gradient(135deg,#ef2b2d,#ffffff,#002868)' },
  'Pakistan':         { flag:'🇵🇰', gradient:'linear-gradient(135deg,#01411c,#ffffff)' },
  'Panama':           { flag:'🇵🇦', gradient:'linear-gradient(135deg,#da121a,#ffffff,#005293)' },
  'Peru':             { flag:'🇵🇪', gradient:'linear-gradient(135deg,#d91023,#ffffff,#d91023)' },
  'Philippines':      { flag:'🇵🇭', gradient:'linear-gradient(135deg,#0038a8,#ffffff,#ce1126)' },
  'Poland':           { flag:'🇵🇱', gradient:'linear-gradient(135deg,#ffffff,#dc143c)' },
  'Portugal':         { flag:'🇵🇹', gradient:'linear-gradient(135deg,#006600,#ff0000)' },
  'Puerto Rico':      { flag:'🇵🇷', gradient:'linear-gradient(135deg,#ed0000,#ffffff,#002a8f)' },
  'Romania':          { flag:'🇷🇴', gradient:'linear-gradient(135deg,#002b7f,#fcd116,#ce1126)' },
  'Russia':           { flag:'🇷🇺', gradient:'linear-gradient(135deg,#ffffff,#0039a6,#d52b1e)' },
  'Rwanda':           { flag:'🇷🇼', gradient:'linear-gradient(135deg,#20603d,#fad201,#20a0d6)' },
  'Saudi Arabia':     { flag:'🇸🇦', gradient:'linear-gradient(135deg,#006c35,#ffffff)' },
  'Serbia':           { flag:'🇷🇸', gradient:'linear-gradient(135deg,#c6363c,#0c4076,#ffffff)' },
  'Singapore':        { flag:'🇸🇬', gradient:'linear-gradient(135deg,#ef3340,#ffffff)' },
  'Slovakia':         { flag:'🇸🇰', gradient:'linear-gradient(135deg,#ffffff,#0b4ea2,#ee1c25)' },
  'Slovak Republic':  { flag:'🇸🇰', gradient:'linear-gradient(135deg,#ffffff,#0b4ea2,#ee1c25)' },
  'Slovenia':         { flag:'🇸🇮', gradient:'linear-gradient(135deg,#003DA5,#ffffff,#CC0000)' },
  'South Africa':     { flag:'🇿🇦', gradient:'linear-gradient(135deg,#007a4d,#000000,#ffb81c,#ffffff,#de3831,#002395)' },
  'South Korea':      { flag:'🇰🇷', gradient:'linear-gradient(135deg,#ffffff,#cd2e3a,#003478)' },
  'Spain':            { flag:'🇪🇸', gradient:'linear-gradient(135deg,#aa151b,#f1bf00,#aa151b)' },
  'Sweden':           { flag:'🇸🇪', gradient:'linear-gradient(135deg,#006aa7,#fecc02)' },
  'Switzerland':      { flag:'🇨🇭', gradient:'linear-gradient(135deg,#ff0000,#ffffff)' },
  'Taiwan':           { flag:'🇹🇼', gradient:'linear-gradient(135deg,#fe0000,#000095)' },
  'Thailand':         { flag:'🇹🇭', gradient:'linear-gradient(135deg,#a51931,#ffffff,#2d2a4a,#ffffff,#a51931)' },
  'Trinidad and Tobago': { flag:'🇹🇹', gradient:'linear-gradient(135deg,#ce1126,#000000,#ffffff)' },
  'Tunisia':          { flag:'🇹🇳', gradient:'linear-gradient(135deg,#e70013,#ffffff)' },
  'Turkey':           { flag:'🇹🇷', gradient:'linear-gradient(135deg,#e30a17,#ffffff)' },
  'UAE':              { flag:'🇦🇪', gradient:'linear-gradient(135deg,#00732f,#ffffff,#000000,#ff0000)' },
  'Ukraine':          { flag:'🇺🇦', gradient:'linear-gradient(135deg,#005bbb,#ffd500)' },
  'United Arab Emirates': { flag:'🇦🇪', gradient:'linear-gradient(135deg,#00732f,#ffffff,#000000,#ff0000)' },
  'United States':    { flag:'🇺🇸', gradient:'linear-gradient(135deg,#b22234,#ffffff,#3c3b6e)' },
  'USA':              { flag:'🇺🇸', gradient:'linear-gradient(135deg,#b22234,#ffffff,#3c3b6e)' },
  'Uruguay':          { flag:'🇺🇾', gradient:'linear-gradient(135deg,#ffffff,#5b9bd5)' },
  'Uzbekistan':       { flag:'🇺🇿', gradient:'linear-gradient(135deg,#1eb53a,#ffffff,#ce1126)' },
  'Venezuela':        { flag:'🇻🇪', gradient:'linear-gradient(135deg,#cf142b,#ffffff,#00247d)' },
  'Vietnam':          { flag:'🇻🇳', gradient:'linear-gradient(135deg,#da251d,#ffcd00)' },
  'Zimbabwe':         { flag:'🇿🇼', gradient:'linear-gradient(135deg,#006400,#ffd200,#d40000,#000000)' },
}

const CHAMP_CATEGORY_DATA: Record<string, { flag: string; gradient: string }> = {
  worlds:   { flag: '🌍', gradient: 'linear-gradient(135deg,#8b0000 0%,#e84c00 20%,#d4a800 40%,#1a7a1a 60%,#0044cc 80%,#7b00d4 100%)' },
  european: { flag: '🇪🇺', gradient: 'linear-gradient(135deg,#003399 0%,#1558c0 50%,#ffcc00 100%)' },
}

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Resolve flag + gradient for a championship race.
 * Priority: worlds/european → country name from race_name → slug parsing → fallback.
 * Direct port of getChampData() from index.html.
 */
function getChampData(r: Race): { flag: string; gradient: string } {
  const sgs = (r.subgenres || []) as string[]
  const slug = r.slug || ''
  const name = r.race_name || ''

  // 1. Worlds / European championships
  if (sgs.includes('worlds') || slug.includes('world-championship')) return CHAMP_CATEGORY_DATA.worlds
  if (sgs.includes('european') || slug.includes('european-championship')) return CHAMP_CATEGORY_DATA.european

  // 2. Parse country from race_name: "National Championships {Country} ME/WE/..."
  const mName = name.match(/Championships?\s+(.+?)(?:\s+(?:ME|WE|MU23|WU23|MJ|WJ)(?:\s|$|-)|$)/i)
  // 3. Parse country from slug: "national-championship(s)-{country}-me/we/..."
  const mSlug = slug.match(/^national-championships?-(.+?)(?:-(?:me|we|mu23|wu23|mj|wj)(?:-itt)?)?$/)

  const candidates: string[] = []
  if (mName) candidates.push(mName[1].trim())
  if (mSlug) {
    const raw = mSlug[1].replace(/-/g, ' ')
    candidates.push(toTitleCase(raw))
    candidates.push(raw.toUpperCase())
  }

  const ALIASES: Record<string, string> = {
    'United Arab Emirates': 'UAE', 'Uae': 'UAE', 'UNITED ARAB EMIRATES': 'UAE',
  }

  for (const country of candidates) {
    const key = ALIASES[country] || country
    if (COUNTRY_CHAMP_DATA[key]) return COUNTRY_CHAMP_DATA[key]
    // Case-insensitive exact match
    const lower = country.toLowerCase()
    for (const [k, v] of Object.entries(COUNTRY_CHAMP_DATA)) {
      if (k.toLowerCase() === lower) return v
    }
    // Substring match
    for (const [k, v] of Object.entries(COUNTRY_CHAMP_DATA)) {
      if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) return v
    }
  }

  // Last resort: scan slug word-by-word
  const slugWords = slug.replace(/-/g, ' ').toLowerCase()
  for (const [k, v] of Object.entries(COUNTRY_CHAMP_DATA)) {
    if (slugWords.includes(k.toLowerCase())) return v
  }

  // Also try the race's existing flag/country fields
  if (r.country && COUNTRY_CHAMP_DATA[r.country]) return COUNTRY_CHAMP_DATA[r.country]

  return { flag: r.flag || '🏳', gradient: r.gradient || 'linear-gradient(135deg,#1e1e2e,#2a2a3e)' }
}

// ── Championship detection ────────────────────────────────────────────────────
// FIX: use race_name instead of race_type. Only races whose name contains
// "Championships" are truly championships. race_type === 'championship' in the DB
// is unreliable — some non-championship races are wrongly tagged.
function isChamp(r: Race): boolean {
  return (r.race_name || '').toLowerCase().includes('championships')
}

// ITT / RR detection — mirrors index.html exactly
function isITT(r: Race): boolean {
  const sgs = (r.subgenres || []) as string[]
  return sgs.includes('ITT') || r.slug.endsWith('-itt')
}

function isRR(r: Race): boolean {
  return !isITT(r) && isChamp(r)
}

// ── Rider name formatting ─────────────────────────────────────────────────────
function _isAllCaps(w: string): boolean {
  return w.length > 0 && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑČŠŽĆĐ]/u.test(w)
}

function formatRiderName(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  let splitIdx = parts.length
  for (let i = 0; i < parts.length; i++) {
    if (!_isAllCaps(parts[i])) { splitIdx = i; break }
  }
  const last = parts.slice(0, splitIdx).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const first = parts.slice(splitIdx).join(' ')
  return first ? `${first} ${last}` : last
}

function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c', '#00594a', '#c0392b', '#9a8430', '#4527a0', '#00838f', '#6d4c41', '#1a4db3']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

function riderInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ── Riders Section ────────────────────────────────────────────────────────────

interface RiderRow {
  rider_name: string
  team_name: string | null
  nationality: string | null
  image_url: string | null
}

function pickBest(rows: any[]): RiderRow {
  const sorted = [...rows].sort((a, b) => {
    const ai = a.image_url && a.image_url !== 'none' ? 1 : 0
    const bi = b.image_url && b.image_url !== 'none' ? 1 : 0
    if (bi !== ai) return bi - ai
    return (b.year || 0) - (a.year || 0)
  })
  const best = sorted[0]
  const latest = rows.reduce((a, b) => ((b.year || 0) > (a.year || 0) ? b : a), rows[0])
  return {
    rider_name: best.rider_name,
    team_name: latest.team_name,
    nationality: latest.nationality,
    image_url: best.image_url && best.image_url !== 'none' ? best.image_url : null,
  }
}

function RidersSection({ featuredRiders }: { featuredRiders: FeaturedRider[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RiderRow[]>([])
  const [searching, setSearching] = useState(false)
  const [label, setLabel] = useState('Featured Riders')

  useEffect(() => {
    if (query.length < 2) {
      setResults([]); setLabel('Featured Riders'); setSearching(false); return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('startlists')
        .select('rider_name,team_name,nationality,image_url,year')
        .ilike('rider_name', `%${query}%`)
        .order('year', { ascending: false })
        .limit(200)
      const grouped = new Map<string, any[]>()
      ;(data || []).forEach((r: any) => {
        const key = r.rider_name.toLowerCase()
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(r)
      })
      const unique: RiderRow[] = Array.from(grouped.values()).map(pickBest).slice(0, 30)
      setResults(unique)
      setLabel(`${unique.length} result${unique.length !== 1 ? 's' : ''}`)
      setSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const displayList: RiderRow[] = query.length >= 2 ? results : featuredRiders

  return (
    <div>
      <div style={{ padding: '22px 40px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, marginBottom: 4 }}>Rider Database</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Search thousands of professional cyclists.</div>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search riders…"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '8px 14px', fontSize: 13, width: 220, outline: 'none' }} />
      </div>

      <div style={{ padding: '28px 40px' }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 18 }}>
          {searching ? 'Searching…' : label}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 16 }}>
          {displayList.map(r => {
            const hasImg = r.image_url && r.image_url !== 'none'
            const col = riderColor(r.rider_name)
            const ini = riderInitials(r.rider_name)
            return (
              <Link key={r.rider_name} href={`/riders/${encodeURIComponent(r.rider_name)}`}
                style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ aspectRatio: '2/3', background: col, overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
                  {hasImg
                    ? <img src={r.image_url!} alt={formatRiderName(r.rider_name)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#fff' }}>{ini}</div>
                  }
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg)', lineHeight: 1.3, marginBottom: 2 }}>
                  {formatRiderName(r.rider_name)}
                </div>
                {r.team_name && (
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.team_name}
                  </div>
                )}
              </Link>
            )
          })}
          {!searching && query.length >= 2 && results.length === 0 && (
            <div style={{ gridColumn: '1/-1', color: 'var(--muted)', fontSize: 12 }}>No riders found for "{query}".</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main RaceGrid ─────────────────────────────────────────────────────────────

export default function RaceGrid({ races, sgLabels, sgClass, featuredRiders }: Props) {
  const { user, isLogged, watchlist } = useUser()
  const [discoverSection, setDiscoverSection] = useState<'races' | 'riders'>('races')
  const [tier, setTier] = useState('all')
  const [tab, setTab] = useState('all')
  const [filterShow, setFilterShow] = useState('all')
  const [search, setSearch] = useState('')
  const [logModal, setLogModal] = useState<{ race: Race; years: number[] } | null>(null)
  const [yearsCache, setYearsCache] = useState<Record<string, number[]>>({})

  const isWT = (r: Race) => r.tier === 'WT'

  // For champ tier: show RR / ITT tabs (matching original index.html behaviour).
  // For other tiers: show race_type tabs.
  const typeTabsForTier = useMemo(() => {
    if (tier === 'champ') return ['RR', 'ITT']
    return [...new Set(races.filter(r => {
      if (tier === 'wt')  return isWT(r) && !isChamp(r)
      if (tier === 'pro') return !isWT(r) && !isChamp(r)
      return !isChamp(r) // 'all'
    }).map(r => r.race_type).filter(Boolean))]
  }, [races, tier])

  const filtered = useMemo(() => {
    return races.filter(r => {
      if (tier === 'wt'    && (!isWT(r) || isChamp(r)))  return false
      if (tier === 'pro'   && (isWT(r)  || isChamp(r)))  return false
      if (tier === 'champ' && !isChamp(r))                return false
      if (tier !== 'champ' && tab !== 'all' && r.race_type !== tab) return false
      // Championship RR/ITT tab filter
      if (tier === 'champ' && tab === 'ITT' && !isITT(r)) return false
      if (tier === 'champ' && tab === 'RR'  && !isRR(r))  return false
      if (filterShow === 'logged'    && !isLogged(r.slug))         return false
      if (filterShow === 'unlogged'  && isLogged(r.slug))          return false
      if (filterShow === 'watchlist' && !watchlist.includes(r.slug)) return false
      if (search && !r.race_name.toLowerCase().includes(search.toLowerCase()) &&
        !(r.country || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [races, tier, tab, filterShow, search, isLogged, watchlist])

  async function openLogModal(race: Race, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!user) { window.location.href = '/login'; return }
    let years = yearsCache[race.slug]
    if (!years) {
      const { data } = await supabase.from('race_results').select('year').eq('slug', race.slug).order('year', { ascending: false })
      years = (data || []).map((r: any) => r.year)
      setYearsCache(prev => ({ ...prev, [race.slug]: years }))
    }
    setLogModal({ race, years })
  }

  return (
    <div>
      {/* Discover sub-tabs */}
      <div className="disc-subtabs">
        <button className={`disc-subtab${discoverSection === 'races' ? ' active' : ''}`}
          onClick={() => setDiscoverSection('races')}>Races</button>
        <button className={`disc-subtab${discoverSection === 'riders' ? ' active' : ''}`}
          onClick={() => setDiscoverSection('riders')}>Riders</button>
      </div>

      {discoverSection === 'riders' && <RidersSection featuredRiders={featuredRiders} />}

      {discoverSection === 'races' && (
        <>
          {/* Tier bar */}
          <div className="tier-bar">
            {TIERS.map(t => (
              <button key={t.key} className={`tier-btn${tier === t.key ? ' active' : ''}`}
                onClick={() => { setTier(t.key); setTab('all') }}>{t.label}</button>
            ))}
          </div>

          {/* Type tabs — RR/ITT for champ, race_type for others */}
          {typeTabsForTier.length > 0 && (
            <div className="tabs">
              <div className={`tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>All</div>
              {typeTabsForTier.map(t => (
                <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t === 'RR' ? 'Road Race' : t === 'ITT' ? 'Time Trial' : t}
                </div>
              ))}
            </div>
          )}

          {/* Filter bar */}
          <div className="fbar">
            <span className="fl">Show:</span>
            {[['all', 'All'], ['logged', 'Logged'], ['unlogged', 'Unlogged'], ['watchlist', 'Watchlist']].map(([v, l]) => (
              <button key={v} className={`fb${filterShow === v ? ' active' : ''}`} onClick={() => setFilterShow(v)}>{l}</button>
            ))}
          </div>

          {/* Search */}
          <div className="search-wrap-disc">
            <input className="search-disc" type="text" placeholder="Search races…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Grid + sidebar */}
          <div className="main-layout">
            <div className="main-content">
              {filtered.length === 0
                ? <div className="empty">No races match your search.</div>
                : <div className="race-grid">
                    {filtered.map(race => (
                      <RaceCard key={race.slug} race={race} sgLabels={sgLabels} sgClass={sgClass}
                        onLog={e => openLogModal(race, e)} />
                    ))}
                  </div>
              }
            </div>
            <div className="sidebar">
              <RecentActivitySidebar />
            </div>
          </div>
        </>
      )}

      {logModal && (
        <LogRaceModal
          slug={logModal.race.slug}
          raceName={logModal.race.race_name}
          gradient={logModal.race.gradient || '#1a1a1a'}
          availYears={logModal.years}
          onClose={() => setLogModal(null)}
        />
      )}
    </div>
  )
}

// ── Race Card ─────────────────────────────────────────────────────────────────

function RaceCard({ race, sgLabels, sgClass, onLog }: {
  race: Race
  sgLabels: Record<string, string>
  sgClass: Record<string, string>
  onLog: (e: React.MouseEvent) => void
}) {
  const { isLogged, getBestRating, watchlist, toggleWatchlist, user } = useUser()
  const logged  = isLogged(race.slug)
  const rating  = getBestRating(race.slug)
  const inWL    = watchlist.includes(race.slug)
  const champ   = isChamp(race)

  // Resolve championship visual data at render time — no DB change needed
  const champData    = champ ? getChampData(race) : null
  const dispGradient = champData ? champData.gradient : (race.gradient || '#1a1a1a')
  const dispFlag     = champData ? champData.flag     : (race.flag || '')

  // Worlds gets the rainbow jersey logo; everything else uses the DB logo_url
  const CHAMP_LOGOS: Record<string, string> = {
    'world-championship':     'https://upload.wikimedia.org/wikipedia/commons/b/b4/Jersey_rainbow.svg',
    'world-championship-itt': 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Jersey_rainbow.svg',
  }
  const dispLogoUrl = race.logo_url || CHAMP_LOGOS[race.slug] || null

  // RR / ITT label shown on championship cards
  const itt = isITT(race)
  const rr  = isRR(race)
  const champLabel = champ ? (rr && itt ? 'RR + ITT' : itt ? 'Time Trial' : 'Road Race') : ''

  function handleWatchlist(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!user) { window.location.href = '/login'; return }
    toggleWatchlist(race.slug)
  }

  return (
    <Link href={`/races/${race.slug}`} className="rc" style={{ textDecoration: 'none' }}>
      <div className="rc-img" style={{ background: dispGradient, position: 'relative', overflow: 'hidden' }}>
        <span className="rc-cat">{champ ? 'CHAMPS' : race.race_type?.toUpperCase()}</span>
        {!champ && race.tier === 'WT' && <span className="rc-wt">WT</span>}

        {/* Logo or flag */}
        {dispLogoUrl ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 8px 22px' }}>
            <img src={dispLogoUrl} alt={race.race_name}
              style={{ maxWidth: '80%', maxHeight: '70%', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.5))' }}
              onError={e => { (e.target as HTMLImageElement).parentElement?.remove() }} />
          </div>
        ) : champ && dispFlag ? (
          // Show large flag emoji as visual identity for national championships
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 48, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.6))' }}>{dispFlag}</span>
          </div>
        ) : null}
      </div>

      <div className="rc-body">
        <div className="rc-ctry">{dispFlag} {race.country}</div>
        <div className="rc-name">{race.race_name}</div>
        {champ && champLabel && (
          <div className="rc-yr" style={{ color: 'var(--gold)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {champLabel}
          </div>
        )}
        <div className="rc-yr">Est. {race.first_year}</div>
        {rating > 0 && (
          <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 4 }}>
            {'★'.repeat(Math.floor(rating))}{rating % 1 ? '½' : ''} {rating.toFixed(1)}
          </div>
        )}
        {race.subgenres && race.subgenres.length > 0 && !champ && (
          <div style={{ marginBottom: 6 }}>
            {(race.subgenres as string[]).slice(0, 2).map(sg => (
              <span key={sg} className={`sg-badge ${sgClass[sg] || ''}`}>{sgLabels[sg] || sg}</span>
            ))}
          </div>
        )}
        <div className="ra">
          <button className={`bsm logged${logged ? ' active' : ''}`} onClick={onLog}>
            {logged ? '✓ Logged' : '+ Log'}
          </button>
          <button className={`bsm${inWL ? ' active' : ''}`} onClick={handleWatchlist}>
            {inWL ? '★' : '☆'}
          </button>
        </div>
      </div>
    </Link>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function RecentActivitySidebar() {
  const { user, logs } = useUser()
  const [raceNames, setRaceNames]         = useState<Record<string, string>>({})
  const [raceGradients, setRaceGradients] = useState<Record<string, string>>({})

  const recent = useMemo(() => {
    return Object.values(logs).flat()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8) as any[]
  }, [logs])

  useEffect(() => {
    const slugs = [...new Set(recent.map(l => l.slug))]
    if (!slugs.length) return
    supabase.from('races').select('slug,race_name,gradient').in('slug', slugs)
      .then(({ data }) => {
        const names: Record<string, string> = {}
        const gradients: Record<string, string> = {}
        ;(data || []).forEach((r: any) => { names[r.slug] = r.race_name; gradients[r.slug] = r.gradient })
        setRaceNames(names); setRaceGradients(gradients)
      })
  }, [recent])

  if (!user) return (
    <div className="empty-log">
      <Link href="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to track your races.
    </div>
  )

  if (!recent.length) return (
    <div className="empty-log">
      No races logged yet. <Link href="/" style={{ color: 'var(--gold)' }}>Start exploring →</Link>
    </div>
  )

  return (
    <div>
      <div className="sb-title">Recent Activity</div>
      {recent.map((l: any) => (
        <Link key={l.id} href={`/races/${l.slug}/${l.year}`}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: raceGradients[l.slug] || 'var(--border)', flexShrink: 0, borderRadius: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {raceNames[l.slug] || l.slug}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{l.year}</div>
          </div>
          {l.rating > 0 && (
            <div style={{ fontSize: 11, color: 'var(--gold)', flexShrink: 0 }}>★ {l.rating}</div>
          )}
        </Link>
      ))}
    </div>
  )
}
