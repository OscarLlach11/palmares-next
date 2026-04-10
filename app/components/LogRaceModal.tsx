'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface Props {
  slug: string
  raceName: string
  gradient: string
  availYears: number[]
  onClose: () => void
  initialYear?: number
}

const RATING_LABELS: Record<number, string> = {
  0: '', 1: 'Unwatchable', 2: 'Disappointing', 3: 'Decent',
  4: 'Good', 5: 'Very Good', 6: 'Great', 7: 'Superb',
  8: 'Excellent', 9: 'Near Perfect', 10: 'All-Time Classic',
}

export default function LogRaceModal({ slug, raceName, gradient, availYears, onClose, initialYear }: Props) {
  const { user, getLog, addLog, updateLog, removeLog } = useUser()
  const existingLogs = getLog(slug)

  const [year, setYear] = useState<number>(initialYear || availYears[0] || new Date().getFullYear())
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [watchedLive, setWatchedLive] = useState(false)
  const [dateWatched, setDateWatched] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'form'>('list')

  // If no existing logs, go straight to form
  useEffect(() => {
    if (existingLogs.length === 0) setView('form')
  }, [existingLogs.length])

  function startNew() {
    setEditingId(null)
    setYear(initialYear || availYears[0] || new Date().getFullYear())
    setRating(0)
    setReview('')
    setWatchedLive(false)
    setDateWatched('')
    setError('')
    setView('form')
  }

  function startEdit(log: any) {
    setEditingId(log.id)
    setYear(log.year)
    setRating(log.rating || 0)
    setReview(log.review || '')
    setWatchedLive(log.watched_live || false)
    setDateWatched(log.date_watched || '')
    setError('')
    setView('form')
  }

  async function handleSave() {
    if (!user) { setError('You must be signed in to log a race.'); return }
    if (!year) { setError('Please select a year.'); return }
    setSaving(true)
    setError('')

    const row = {
      user_id: user.id,
      slug,
      year,
      rating: rating || null,
      review: review.trim() || null,
      watched_live: watchedLive,
      date_watched: dateWatched || null,
    }

    if (editingId) {
      const { data, error: err } = await supabase.from('race_logs').update(row).eq('id', editingId).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      updateLog(data)
    } else {
      const { data, error: err } = await supabase.from('race_logs').insert(row).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      addLog(data)
    }

    setSaving(false)
    setView('list')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this log entry?')) return
    const { error: err } = await supabase.from('race_logs').delete().eq('id', id)
    if (err) { setError(err.message); return }
    removeLog(id, slug)
    if (existingLogs.length <= 1) onClose()
    else setView('list')
  }

  const currentYearLogs = existingLogs.filter(l => l.year === year)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Banner */}
        <div style={{ height: 120, background: gradient, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '12px 20px' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.6)', border: '1px solid var(--border)', color: 'var(--fg)', width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, lineHeight: 1 }}>{raceName}</div>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontStyle: 'italic', color: 'var(--gold)', fontSize: 13 }}>
              {editingId ? 'Edit Log' : 'Log Race'}
            </span>
          </div>
        </div>

        <div style={{ padding: 22 }}>

          {/* List view — show existing logs */}
          {view === 'list' && existingLogs.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, color: 'var(--gold)' }}>Your Logs</div>
                <button onClick={startNew} className="bs" style={{ fontSize: 10 }}>+ Add Another</button>
              </div>
              {existingLogs.map(log => (
                <div key={log.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2 }}>{log.year}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startEdit(log)} className="bs" style={{ fontSize: 9, padding: '4px 10px' }}>Edit</button>
                      <button onClick={() => handleDelete(log.id)} style={{ background: 'none', border: '1px solid #555', color: '#888', fontSize: 9, padding: '4px 10px', cursor: 'pointer', letterSpacing: 1 }}>Delete</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
                    {log.rating && <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}>★ {log.rating}</span>}
                    {log.watched_live && <span style={{ color: '#e74c3c' }}>🔴 Live</span>}
                    {log.date_watched && <span>{log.date_watched}</span>}
                  </div>
                  {log.review && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 6, lineHeight: 1.6 }}>
                      "{log.review.slice(0, 200)}{log.review.length > 200 ? '…' : ''}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Form view */}
          {view === 'form' && (
            <div>
              {existingLogs.length > 0 && (
                <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, marginBottom: 16, padding: 0 }}>← Back to logs</button>
              )}

              {/* Year + Date + Live */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Edition Year</label>
                  <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '7px 10px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, minWidth: 100 }}>
                    {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
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

              {/* Rating */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 10 }}>Rating</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button key={n} onClick={() => setRating(rating === n ? 0 : n)}
                      style={{ width: 36, height: 36, fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", cursor: 'pointer', background: rating === n ? 'var(--gold)' : 'var(--card-bg)', color: rating === n ? '#000' : 'var(--fg)', border: `1px solid ${rating === n ? 'var(--gold)' : 'var(--border)'}`, transition: 'all .15s' }}>
                      {n}
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 1 }}>{RATING_LABELS[rating]}</div>
                )}
              </div>

              {/* Review */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Review <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <textarea value={review} onChange={e => setReview(e.target.value)} rows={4}
                  placeholder="What made this race memorable?"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none' }} />
              </div>

              {error && <div style={{ fontSize: 12, color: '#e05', marginBottom: 12, padding: '8px 12px', background: 'rgba(220,0,80,.1)', border: '1px solid rgba(220,0,80,.2)' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} className="bp" style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : editingId ? 'Update Log' : 'Save Log'}
                </button>
                <button onClick={() => existingLogs.length > 0 ? setView('list') : onClose()} className="bs">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
