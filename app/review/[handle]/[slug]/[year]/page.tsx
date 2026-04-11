'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import ReviewLikes from '@/app/components/ReviewLikes'

function formatRiderName(name: string): string {
  if (!name) return ''
  return name.split(' ').map(w =>
    w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w
  ).join(' ')
}

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(s => {
        const fill = Math.min(1, Math.max(0, rating - (s - 1)))
        const pct = Math.round(fill * 100)
        return (
          <div key={s} style={{ position: 'relative', width: 18, height: 18 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
              <path fill="var(--border-light)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <svg width={18} height={18} viewBox="0 0 24 24" style={{ position: 'absolute', clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
              <path fill="var(--gold)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        )
      })}
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--gold)', marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </div>
  )
}

interface ReviewComment {
  id: string
  user_id: string
  handle: string
  display_name: string
  text: string
  created_at: string
}

function ReviewPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile } = useUser()

  // params: handle, slug, year — n is optional query param (?n=2)
  const handle = params.handle as string
  const slug = params.slug as string
  const year = parseInt(params.year as string)
  const n = parseInt(searchParams.get('n') || '1')

  const [loading, setLoading] = useState(true)
  const [race, setRace] = useState<any>(null)
  const [reviewEntry, setReviewEntry] = useState<any>(null)
  const [reviewerProfile, setReviewerProfile] = useState<any>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const reviewKey = `${handle}/${slug}/${year}/${n}`
  const isOwnReview = user && (profile?.handle === handle || user.id === handle)

  useEffect(() => {
    load()
  }, [handle, slug, year, n])

  async function load() {
    setLoading(true)

    // Load race info
    const { data: raceData } = await supabase
      .from('races').select('slug,race_name,gradient,logo_url,flag,country').eq('slug', slug).maybeSingle()
    setRace(raceData)

    // Load reviewer profile
    const { data: profData } = await supabase
      .from('profiles').select('user_id,display_name,handle,avatar_url').eq('handle', handle).maybeSingle()
    setReviewerProfile(profData)

    if (!profData) { setLoading(false); return }

    // Load the specific review (nth review with a non-null review field for this race)
    const { data: logs } = await supabase
      .from('race_logs')
      .select('id,rating,review,watched_live,date_watched,year,created_at')
      .eq('user_id', profData.user_id)
      .eq('slug', slug)
      .eq('year', year)
      .not('review', 'is', null)
      .order('created_at', { ascending: true })
    const entry = logs?.[n - 1] || null
    setReviewEntry(entry)

    // Load comments
    const { data: commentsData } = await supabase
      .from('review_comments')
      .select('id,user_id,handle,display_name,text,created_at')
      .eq('review_key', reviewKey)
      .order('created_at', { ascending: true })
    setComments(commentsData || [])

    setLoading(false)
  }

  async function postComment() {
    if (!user || !commentText.trim()) return
    setPosting(true)
    setError('')
    const { data, error: err } = await supabase
      .from('review_comments')
      .insert({
        review_key: reviewKey,
        user_id: user.id,
        handle: profile?.handle || '',
        display_name: profile?.display_name || '',
        text: commentText.trim(),
      })
      .select().single()
    if (err) { setError(err.message); setPosting(false); return }
    setComments(prev => [...prev, data])
    setCommentText('')
    setPosting(false)

    // Fire notification to review owner (if not own review)
    if (reviewerProfile && reviewerProfile.user_id !== user.id) {
      supabase.from('notifications').insert({
        user_id: reviewerProfile.user_id,
        type: 'comment',
        actor_id: user.id,
        actor_handle: profile?.handle || '',
        actor_name: profile?.display_name || 'Someone',
        review_key: reviewKey,
        comment_text: commentText.trim().slice(0, 100),
        read: false,
      }).then(() => {})
    }
  }

  async function deleteComment(id: string) {
    if (!confirm('Delete this comment?')) return
    await supabase.from('review_comments').delete().eq('id', id).eq('user_id', user?.id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  if (!reviewEntry || !reviewerProfile) return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 40 }}>
      <div style={{ color: 'var(--muted)', textAlign: 'center' }}>
        Review not found.
        <div style={{ fontSize: 11, marginTop: 8 }}>This review may have been deleted or the link is incorrect.</div>
      </div>
    </div>
  )

  const ini = (reviewerProfile.display_name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
      {/* Back */}
      <div style={{ marginBottom: 28 }}>
        <Link href={`/races/${slug}/${year}`} className="bs" style={{ textDecoration: 'none', fontSize: 10 }}>← Back to {race?.race_name || slug} {year}</Link>
      </div>

      {/* Race + reviewer header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 56, height: 56, flexShrink: 0, background: race?.gradient || 'var(--border)', borderRadius: 2 }}>
          {race?.logo_url && <img src={race.logo_url} alt={race.race_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />}
        </div>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 3 }}>{race?.race_name || slug}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {year} Edition · Review by{' '}
            <Link href={`/profile/${handle}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>@{handle}</Link>
            {n > 1 && ` (review #${n})`}
          </div>
        </div>
      </div>

      {/* Review body */}
      <div style={{ marginBottom: 24 }}>
        {/* Reviewer info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, overflow: 'hidden', flexShrink: 0 }}>
            {reviewerProfile.avatar_url
              ? <img src={reviewerProfile.avatar_url} alt={reviewerProfile.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : ini}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{reviewerProfile.display_name || handle}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {reviewEntry.date_watched ? fmtDate(reviewEntry.date_watched) : fmtDate(reviewEntry.created_at.split('T')[0])}
            </div>
          </div>
        </div>

        {/* Rating */}
        {reviewEntry.rating && (
          <div style={{ marginBottom: 12 }}>
            <StarDisplay rating={reviewEntry.rating} />
          </div>
        )}

        {/* Live badge */}
        {reviewEntry.watched_live && (
          <span style={{ fontSize: 9, letterSpacing: 1.5, color: '#e74c3c', border: '1px solid #e74c3c', padding: '2px 8px', display: 'inline-block', marginBottom: 14 }}>
            WATCHED LIVE
          </span>
        )}

        {/* Review text */}
        <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--fg)', whiteSpace: 'pre-wrap', marginTop: 12 }}>
          {reviewEntry.review}
        </div>
      </div>

      {/* Likes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 32 }}>
        <ReviewLikes reviewKey={reviewKey} isOwnReview={!!isOwnReview} />
      </div>

      {/* Comments */}
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>Comments</div>

        {comments.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>No comments yet.</div>
        )}

        {comments.map(c => (
          <div key={c.id} className="rv-comment">
            <div className="rv-comment-author" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link href={`/profile/${c.handle}`} style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: 11, letterSpacing: 1 }}>
                @{c.handle || c.display_name}
              </Link>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtDate(c.created_at.split('T')[0])}</span>
              {user?.id === c.user_id && (
                <button onClick={() => deleteComment(c.id)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>✕</button>
              )}
            </div>
            <div className="rv-comment-text" style={{ marginTop: 4 }}>{c.text}</div>
          </div>
        ))}

        {user ? (
          <div style={{ marginTop: 20 }}>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postComment() }}
              placeholder="Leave a comment…"
              className="rv-comment-input"
              rows={3}
            />
            {error && <div style={{ fontSize: 12, color: '#e05', marginTop: 4 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <button onClick={postComment} disabled={posting || !commentText.trim()} className="bs" style={{ fontSize: 10 }}>
                {posting ? 'Posting…' : 'Post'}
              </button>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Ctrl+Enter to post</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <Link href="/login" className="bs" style={{ fontSize: 10, textDecoration: 'none', display: 'inline-block' }}>Sign in to comment</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReviewPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>}>
      <ReviewPageInner />
    </Suspense>
  )
}
