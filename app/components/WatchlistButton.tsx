'use client'
import { useUser } from '@/app/context/UserContext'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
}

export default function WatchlistButton({ slug }: Props) {
  const { user, watchlist, toggleWatchlist } = useUser()
  const router = useRouter()
  const inWL = watchlist.includes(slug)

  function handleClick() {
    if (!user) { router.push('/login'); return }
    toggleWatchlist(slug)
  }

  return (
    <button
      onClick={handleClick}
      className={`bs${inWL ? ' bwl on' : ' bwl'}`}
      style={{ marginLeft: 8 }}
    >
      {inWL ? '★ In Watchlist' : '+ Watchlist'}
    </button>
  )
}
