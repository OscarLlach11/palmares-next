'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface Comment {
  id: string
  user_id: string
  handle: string
  display_name: string
  text: string
  created_at: string
}

interface Props {
  slug: string
  year: number
  stageNum: number
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function StageComments({ slug, year, stageNum }: Props) {
  const { user, profile } = useUser()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('stage_edition_comments')
      .select('id,user_id,handle,display_name,text,created_at')
      .eq('race_slug', slug)
      .eq('year', year)
      .eq('stage_num', stageNum)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setComments(data || []); setLoading(false) })
  }, [slug, year, stageNum])

  async function postComment() {
    if (!user || !text.trim()) return
    setPosting(true)
    setError('')
    const { data, error: err } = await supabase
      .from('stage_edition_comments')
      .insert({
        race_slug: slug, year, stage_num: stageNum,
        user_id: user.id,
        handle: profile?.handle || '',
        display_name: profile?.display_name || '',
        text: text.trim(),
      })
      .select().single()
    if (err) { setError(err.message); setPosting(false); return }
    setComments(prev => [...prev, data])
    setText('')
    setPosting(false)
  }

  async function deleteComment(id: string) {
    if (!confirm('Delete this comment?')) return
    await supabase.from('stage_edition_comments').delete().eq('id', id).eq('user_id', user?.id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="rsp-section">
      <div className="rsp-st">Comments</div>

      {loading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {!loading && comments.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>No comments yet. Be the first!</div>
      )}

      {comments.map(c => (
        <div key={c.id} className="edition-comment">
          <div className="edition-comment-author">
            <Link href={`/profile/${c.handle}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              {c.handle || c.display_name || 'User'}
            </Link>
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 10 }}>{fmtDate(c.created_at)}</span>
            {user?.id === c.user_id && (
              <button onClick={() => deleteComment(c.id)} className="edition-comment-delete">✕</button>
            )}
          </div>
          <div className="edition-comment-text">{c.text}</div>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        {user ? (
          <>
            <textarea value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postComment() }}
              placeholder="Comment on this stage…" rows={3}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
            {error && <div style={{ fontSize: 12, color: '#e05', marginTop: 4 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <button onClick={postComment} disabled={posting || !text.trim()} className="bs" style={{ fontSize: 10 }}>
                {posting ? 'Posting…' : 'Post'}
              </button>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Ctrl+Enter to post</span>
            </div>
          </>
        ) : (
          <Link href="/login" className="bs" style={{ fontSize: 10, textDecoration: 'none', display: 'inline-block' }}>Sign in to comment</Link>
        )}
      </div>
    </div>
  )
}
