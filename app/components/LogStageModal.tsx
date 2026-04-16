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

const RATING_LABELS: Record<string, string> = {
  '0': '', '0.5': 'Just Riding', '1': 'Unwatchable', '1.5': 'Very Poor',
  '2': 'Disappointing', '2.5': 'Decent', '3': 'Good', '3.5': 'Very Good',
  '4': 'Great', '4.5': 'Superb', '5': 'All-Time Classic',
}

// ── Interactive half-star widget ──────────────────────────────────────────────
// Identical to the one in LogRaceModal — hover left half = half value,
// hover right half = full value, click to set, click same to clear.
function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, cursor: 'pointer' }}>
        {[1, 2, 3, 4, 5].map(star => {
          const fillPct =
            display >= star ? 100 :
            display >= star - 0.5 ? 50 : 0
          return (
            <div key={star} style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
              <svg width={32} height={32} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
                <path fill="var(--border-light)"
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <svg width={32} height={32} viewBox="0 0 24 24"
                style={{ position: 'absolute', top: 0, left: 0, clipPath: `inset(0 ${100 - fillPct}% 0 0)` }}>
                <path fill="var(--gold)"
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <div
                style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 2 }}
                onMouseEnter={() => setHovered(star - 0.5)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => onChange(value === star - 0.5 ? 0 : star - 0.5)}
              />
              <div
                style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', zIndex: 2 }}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => onChange(value === star ? 0 : star)}
              />
            </div>
          )
        })}
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
          color: 'var(--gold)', letterSpacing: 1, marginLeft: 8,
          lineHeight: '32px',
        }}>
          {display > 0 ? display.toFixed(1) : '—'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', minHeight: 16, letterSpacing: 0.5 }}>
        {RATING_LABELS[String(hovered || value)] || ''}
      </div>
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
    async function checkExisting() {
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('stage_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('race_slug', slug)
        .eq('year', year)
        .eq('stage_num', stageNum)
        .maybeSingle()
      if (data) {
        setExistingLog(data)
        setRating(data.rating || 0)
        setReview(data.review || '')
        setWatchedLive(data.watched_live || false)
        setDateWatched(data.date_watched || '')
      }
      setLoading(false)
    }
    checkExisting()
  }, [user, slug, year, stageNum])

  async function handleSave() {
    if (!user) { setError('Sign in to log stages.'); return }
    setSaving(true); setError('')
    try {
      if (existingLog) {
        const { error: err } = await supabase
          .from('stage_logs')
          .update({ rating: rating || null, review: review.trim() || null, watched_live: watchedLive, date_watched: dateWatched || null })
          .eq('id', existingLog.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('stage_logs')
          .insert({ user_id: user.id, race_slug: slug, year, stage_num: stageNum, rating: rating || null, review: review.trim() || null, watched_live: watchedLive, date_watched: dateWatched || null })
        if (err) throw err
      }
      router.refresh()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!user || !existingLog) return
    await supabase.from('stage_logs').delete().eq('id', existingLog.id)
    router.refresh()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 40, background: gradient, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, color: 'var(--fg)' }}>{raceName}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, marginTop: 1 }}>{label} · {year}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 20px 24px' }}>
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading…</div>
          ) : !user ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sign in to log this stage.</div>
          ) : (
            <>
              {/* Date + Live */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Date Watched</label>
                  <input type="date" value={dateWatched} onChange={e => setDateWatched(e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '7px 10px', fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div onClick={() => setWatchedLive(!watchedLive)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 14px', border: `1px solid ${watchedLive ? '#e74c3c' : 'var(--border)'}`, background: watchedLive ? 'rgba(231,76,60,.07)' : 'transparent', transition: 'all .15s', userSelect: 'none' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: watchedLive ? '#e74c3c' : 'var(--muted)', boxShadow: watchedLive ? '0 0 5px #e74c3c' : 'none', transition: 'all .15s' }} />
                    <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: watchedLive ? '#e74c3c' : 'var(--muted)' }}>Watched Live</span>
                  </div>
                </div>
              </div>

              {/* ── STAR RATING INPUT ── */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 12 }}>Rating</label>
                <StarRatingInput value={rating} onChange={setRating} />
              </div>

              {/* Review */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                  Review <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
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
                  <button onClick={handleDelete}
                    style={{ marginLeft: 'auto', background: 'none', border: '1px solid #555', color: '#888', fontSize: 9, padding: '8px 14px', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>
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
