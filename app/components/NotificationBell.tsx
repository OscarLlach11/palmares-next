'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface Notification {
  id: string
  type: 'follow' | 'like' | 'comment'
  read: boolean
  created_at: string
  actor_name: string | null
  actor_handle: string | null
  race_id: string | null
  review_key: string | null
  comment_text: string | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const { user } = useUser()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    if (!user) return
    loadNotifications()
  }, [user])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function loadNotifications() {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs(data || [])
  }

  async function openDrawer() {
    setOpen(true)
    if (!user) return
    // Mark all as read
    if (unread > 0) {
      await supabase.from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  function notifText(n: Notification) {
    const actor = n.actor_name || 'Someone'
    if (n.type === 'follow') return <span><strong>{actor}</strong> started following you.</span>
    if (n.type === 'like') return <span><strong>{actor}</strong> liked your review.</span>
    if (n.type === 'comment') return (
      <span>
        <strong>{actor}</strong> commented on your review.
        {n.comment_text && <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 11, fontStyle: 'italic' }}>"{n.comment_text.slice(0, 80)}"</div>}
      </span>
    )
    return <span><strong>{actor}</strong> interacted with your content.</span>
  }

  function notifHref(n: Notification) {
    if (n.type === 'follow' && n.actor_handle) return `/profile/${n.actor_handle}`
    if (n.review_key) {
      const [handle, slug, year] = n.review_key.split('/')
      return `/review/${handle}/${slug}/${year}`
    }
    return '#'
  }

  if (!user) return null

  return (
    <div style={{ position: 'relative' }} ref={drawerRef}>
      <button onClick={openDrawer}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: 4 }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--gold)', color: '#000', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, background: 'var(--card-bg)', border: '1px solid var(--border)', zIndex: 200, maxHeight: 420, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2 }}>Notifications</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              No notifications yet.
              <div style={{ marginTop: 6, fontSize: 11 }}>You'll be notified when someone follows you, likes a review, or leaves a comment.</div>
            </div>
          ) : notifs.map(n => (
            <Link key={n.id} href={notifHref(n)} onClick={() => setOpen(false)}
              style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', textDecoration: 'none', background: n.read ? 'transparent' : 'rgba(232,200,74,.04)', transition: 'background .1s' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : 'var(--gold)', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>{notifText(n)}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
