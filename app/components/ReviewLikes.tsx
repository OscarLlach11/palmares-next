'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import { useRouter } from 'next/navigation'

interface Props {
  reviewKey: string // format: "handle/slug/year/n"
  isOwnReview: boolean
}

export default function ReviewLikes({ reviewKey, isOwnReview }: Props) {
  const { user } = useUser()
  const router = useRouter()
  const [count, setCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('review_likes')
        .select('user_id')
        .eq('review_key', reviewKey)
      setCount(data?.length || 0)
      if (user) setLiked(!!(data?.some((l: any) => l.user_id === user.id)))
      setLoading(false)
    }
    load()
  }, [reviewKey, user])

  async function toggle() {
    if (!user) { router.push('/login'); return }
    if (isOwnReview) return
    if (liked) {
      setLiked(false)
      setCount(c => c - 1)
      await supabase.from('review_likes').delete()
        .eq('review_key', reviewKey).eq('user_id', user.id)
    } else {
      setLiked(true)
      setCount(c => c + 1)
      await supabase.from('review_likes').upsert({ review_key: reviewKey, user_id: user.id })
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || isOwnReview}
      className={`rv-like-btn${liked ? ' liked' : ''}`}
      title={isOwnReview ? 'You cannot like your own review' : liked ? 'Unlike' : 'Like'}
    >
      {liked ? '♥' : '♡'} <span>{count}</span> {count === 1 ? 'like' : 'likes'}
    </button>
  )
}
