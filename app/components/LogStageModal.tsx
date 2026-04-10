'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  raceName: string
  gradient: string
  year: number
  stageNum: number
  stageLabel?: string
  onClose: () => void
}

const HALF_STARS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const RATING_LABELS: Record<string, string> = {
  '0.5': 'Just Riding', '1': 'Unwatchable', '1.5': 'Very Poor',
  '2': 'Disappointing', '2.5': 'Decent', '3': 'Good', '3.5': 'Very Good',
  '4': 'Great', '4.5': 'Superb', '5': 'All-Time Classic',
}

function StarDisplay({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => {
        const fill = Math.min(1, Math.max(0, rating - (s - 1)))
        const pct = Math.round(fill * 100)
        return (
          <div key={s} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
              <path fill="var(--border-light)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
              <path fill="var(--gold)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        )
      })}
    </div>
  )
}

export default function LogStageModal({ slug, raceName, gradient, year, stageNum, stageLabel, onClose }: Props) {
  const { user } = useUser()
  const router = useRouter()
  const [existingLog, setExistingLog] = useState<any>(null)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [watchedLive, setWatchedLive] = useState(false)
  const [dateWatched, setDateWatched] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const label = stageNum === 0 ? 'Prologue' : `Stage ${stageLabel || stageNum}`

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('stage_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('race_slug', slug)
      .eq('year', year)
      .eq('stage_num', stageNum)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingLog(data)
          setRating(data.rating || 0)
          setReview(data.review || '')
          setWatchedLive(data.watched_live || false)
          setDateWatched(data.date_watched || '')
        }
        setLoading(false)
      })
  }, [user, slug, year, stageNum])

  async function handleSave() {
    if (!user) { router.push('/login'); return }
    setSaving(true)
    setError('')

    const row = {
      user_id: user.id,
      race_slug: slug,
      year,
      stage_num: stageNum,
      rating: rating || null,
      review: review.trim() || null,
      watched_live: watchedLive,
      date_watched: dateWatched || null,
    }

    if (existingLog) {
      const { error: err } = await supabase.from('stage_logs').update(row).eq('id', existingLog.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('stage_logs').insert(row)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!existingLog || !confirm('Delete this stage log?')) return
    await supabase.from('stage_logs').delete().eq('id', existingLog.id)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Banner */}
        <div style={{ height: 100, background: gradient, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '12px 20px' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.6)', border: '1px solid var(--border)', color: 'var(--fg)', width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, lineHeight: 1 }}>{raceName}</div>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontStyle: 'italic', color: 'var(--gold)', fontSize: 13 }}>
              {year} · {label}
            </span>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading…</div>
          ) : (
            <>
              {existingLog && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(232,200,74,.06)', border: '1px solid var(--gold-dim)', fontSize: 12, color: 'var(--gold)' }}>
                  ✓ You've already logged this stage — editing your existing entry.
                </div>
              )}

              {/* Year + Date + Live */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Date Watched</label>
                  <input type="date" value={dateWatched} onChange={e => setDateWatched(e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '7px 10px', fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div onClick={() => setWatchedLive(!watchedLive)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 14px', border: `1px solid ${watchedLive ? '#e74c3c' : 'var(--border)'}`, background: watchedLive ? 'rgba(231,76,60,.07)' : 'transparent', transition: 'all .15s', userSelect: 'none' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: watchedLive ? '#e74c3c' : 'var(--muted)', transition: 'all .15s' }} />
                    <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: watchedLive ? '#e74c3c' : 'var(--muted)' }}>Watched Live</span>
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 10 }}>Rating</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {HALF_STARS.map(n => (
                    <button key={n} onClick={() => setRating(rating === n ? 0 : n)}
                      style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', background: rating === n ? 'var(--gold)' : 'var(--card-bg)', color: rating === n ? '#000' : 'var(--fg)', border: `1px solid ${rating === n ? 'var(--gold)' : 'var(--border)'}`, transition: 'all .15s' }}>
                      {n}
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StarDisplay rating={rating} />
                    <span style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 1 }}>{RATING_LABELS[String(rating)]}</span>
                  </div>
                )}
              </div>

              {/* Review */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Review <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <textarea value={review} onChange={e => setReview(e.target.value)} rows={3}
                  placeholder="How was this stage?"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none' }} />
              </div>

              {error && <div style={{ fontSize: 12, color: '#e05', marginBottom: 12, padding: '8px 12px', background: 'rgba(220,0,80,.1)', border: '1px solid rgba(220,0,80,.2)' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} className="bp" style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : existingLog ? 'Update Log' : 'Save Log'}
                </button>
                <button onClick={onClose} className="bs">Cancel</button>
                {existingLog && (
                  <button onClick={handleDelete} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #555', color: '#888', fontSize: 9, padding: '8px 14px', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
