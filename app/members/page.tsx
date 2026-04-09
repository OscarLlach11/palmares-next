import { supabase } from '@/lib/supabase'
import MembersClient from '../components/MembersClient'

export const revalidate = 300

async function getMembers() {
  const [{ data: profiles }, { data: followCounts }] = await Promise.all([
    supabase.from('profiles').select('user_id, display_name, handle, avatar_url, fav_riders').not('display_name', 'is', null).limit(20),
    supabase.from('follows').select('following_id').limit(5000),
  ])

  if (!profiles?.length) return []

  const counts: Record<string, number> = {}
  ;(followCounts || []).forEach(r => { counts[r.following_id] = (counts[r.following_id] || 0) + 1 })

  const sorted = profiles
    .map(p => ({ ...p, followerCount: counts[p.user_id] || 0 }))
    .sort((a, b) => b.followerCount - a.followerCount)
    .slice(0, 5)

  // Fetch rider images for all fav_riders in one batch
  const getRiderName = (r: unknown): string => (r && typeof r === 'object' && 'name' in r) ? String((r as {name: string}).name) : String(r || '')
  const allRiderNames = [...new Set(sorted.flatMap(m => (m.fav_riders || []).map(getRiderName).filter(Boolean)))]

  if (allRiderNames.length) {
    const { data: batchRows } = await supabase
      .from('startlists')
      .select('rider_name, image_url, year')
      .in('rider_name', allRiderNames)
      .order('year', { ascending: false })
      .limit(500)

    const riderImgMap: Record<string, string> = {}
    ;(batchRows || []).forEach(r => {
      if (r.image_url && r.image_url !== 'none') {
        riderImgMap[r.rider_name.toLowerCase()] = r.image_url
      }
    })

    return sorted.map(m => ({
      ...m,
      ridersWithImages: (m.fav_riders || []).map(getRiderName).filter(Boolean).map(name => ({
        name,
        image_url: riderImgMap[name.toLowerCase()] || null,
      }))
    }))
  }

  return sorted.map(m => ({ ...m, ridersWithImages: [] }))
}

export default async function MembersPage() {
  const members = await getMembers()

  return (
    <>
      <div className="hero" style={{ paddingBottom: 32 }}>
        <div className="hero-bg">PELOTON</div>
        <div className="eyebrow">— The Community</div>
        <h1>Find <em>fellow</em> fans.</h1>
      </div>
      <MembersClient initialMembers={members} />
    </>
  )
}
