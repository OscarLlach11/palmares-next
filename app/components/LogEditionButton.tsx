'use client'
import { useState } from 'react'
import { useUser } from '@/app/context/UserContext'
import LogRaceModal from './LogRaceModal'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  raceName: string
  gradient: string
  year: number
  availYears: number[]
}

export default function LogEditionButton({ slug, raceName, gradient, year, availYears }: Props) {
  const { user, isLogged, getLog } = useUser()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleClick() {
    if (!user) { router.push('/login'); return }
    setOpen(true)
  }

  const logged = isLogged(slug)
  const thisYearLog = getLog(slug).find(l => l.year === year)

  return (
    <>
      <button onClick={handleClick} className="bp" style={{ marginRight: 8 }}>
        {thisYearLog ? '✓ Edit My Log' : '+ Log This Race'}
      </button>

      {open && (
        <LogRaceModal
          slug={slug}
          raceName={raceName}
          gradient={gradient}
          availYears={availYears}
          initialYear={year}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
