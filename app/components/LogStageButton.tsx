'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@/app/context/UserContext'
import LogStageModal from './LogStageModal'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  raceName: string
  gradient: string
  year: number
  stageNum: number
  stageLabel?: string
}

export default function LogStageButton({ slug, raceName, gradient, year, stageNum, stageLabel }: Props) {
  const { user } = useUser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLogged, setIsLogged] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('stage_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('race_slug', slug)
      .eq('year', year)
      .eq('stage_num', stageNum)
      .maybeSingle()
      .then(({ data }) => setIsLogged(!!data))
  }, [user, slug, year, stageNum])

  function handleClick() {
    if (!user) { router.push('/login'); return }
    setOpen(true)
  }

  return (
    <>
      <button onClick={handleClick} className="bp">
        {isLogged ? '✓ Edit Stage Log' : '+ Log This Stage'}
      </button>
      {open && (
        <LogStageModal
          slug={slug}
          raceName={raceName}
          gradient={gradient}
          year={year}
          stageNum={stageNum}
          stageLabel={stageLabel}
          onClose={() => { setOpen(false); setIsLogged(true) }}
        />
      )}
    </>
  )
}
