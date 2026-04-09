import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q.trim()) return NextResponse.json([])

  const { data } = await supabase
    .from('profiles')
    .select('user_id, display_name, handle, avatar_url, fav_riders')
    .or(`display_name.ilike.%${q}%,handle.ilike.%${q}%`)
    .not('display_name', 'is', null)
    .limit(20)

  return NextResponse.json(data?.map(p => ({ ...p, followerCount: 0, ridersWithImages: [] })) || [])
}
