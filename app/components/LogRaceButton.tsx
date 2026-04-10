'use client'
import { useState } from 'react'
import { useUser } from '@/app/context/UserContext'
import LogRaceSearch from './LogRaceSearch'
import LogRaceModal from './LogRaceModal'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  raceName: string
  gradient: string
}

export default function LogRaceButton({ slug, raceName, gradient }: Props) {
  const { user, isLogged, getBestRating } = useUser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [years, setYears] = useState<number[]>([])

  const logged = isLogged(slug)
  const rating = getBestRating(slug)

  async function handleClick() {
    if (!user) { router.push('/login'); return }
    if (!years.length) {
      const { data } = await supabase
        .from('race_results').select('year').eq('slug', slug).order('year', { ascending: false })
      setYears((data || []).map((r: any) => r.year))
    }
    setOpen(true)
  }

  return (
    <>
      <button onClick={handleClick} className={logged ? 'bp' : 'bs'}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {logged ? (
          <>✓ Logged {rating > 0 && <span style={{ opacity: 0.8 }}>· ★ {rating.toFixed(1)}</span>}</>
        ) : '+ Log Race'}
      </button>

      {open && years.length > 0 && (
        <LogRaceModal
          slug={slug}
          raceName={raceName}
          gradient={gradient}
          availYears={years}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
