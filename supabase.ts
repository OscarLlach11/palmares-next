import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pkbxgeloejmnblwpsuch.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrYnhnZWxvZWptbmJsd3BzdWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTU0MDcsImV4cCI6MjA4ODM5MTQwN30.2JbsShp7ZIQ4qs-kgF7_O4wWZDTgQ_qDdI9X9SFjnWA'

// Server-side client (used in Server Components and Route Handlers)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Types matching the Supabase schema
export interface Race {
  slug: string
  race_name: string
  race_type: string
  first_year: number
  last_year: number | null
  tv_year: number | null
  tier: string
  country: string
  flag: string
  distance: number | null
  gradient: string
  swatch: string
  description: string | null
  subgenres: string[] | null
  stage_count: number | null
  logo_url: string | null
}

export interface RaceResult {
  slug: string
  year: number
  race_type: string
  top10: string[]
}

export interface StageResult {
  id: string
  race_slug: string
  year: number
  stage_num: number
  stage_label: string
  stage_date: string | null
  stage_type: string | null
  profile_score: number | null
  distance_km: number | null
  departure: string | null
  arrival: string | null
  avg_speed: number | null
  top10: string[] | null
  gc_top5: string[] | null
  winner: string | null
  winner_team: string | null
  gc_leader: string | null
}

export interface Profile {
  user_id: string
  display_name: string | null
  handle: string | null
  fav_riders: unknown[] | null
  fav_race_slug: string | null
  fav_race_year: number | null
  fav_race_stage: number | null
  avatar_url: string | null
}

export interface RaceLog {
  id: string
  user_id: string
  slug: string
  year: number
  rating: number | null
  review: string | null
  watched_live: boolean | null
  date_watched: string | null
  created_at: string
}
