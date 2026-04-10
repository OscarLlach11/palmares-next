'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

export default function LoginPage() {
  const router = useRouter()
  const { user } = useUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // If already logged in, redirect home
  useEffect(() => {
    if (user) router.push('/')
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // Check if onboarding complete
      const { data: session } = await supabase.auth.getSession()
      const uid = session.session?.user?.id
      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('onboarding_complete').eq('user_id', uid).maybeSingle()
        if (prof && prof.onboarding_complete === false) {
          router.push('/onboarding')
        } else {
          router.push('/')
        }
      } else {
        router.push('/')
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      if (data.session) {
        // Email confirmation disabled — session available immediately
        router.push('/onboarding')
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.')
      }
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 4 }}>PALMARÈS</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />

          {error && <div style={{ fontSize: 12, color: '#e05', padding: '8px 12px', background: 'rgba(220,0,80,.1)', border: '1px solid rgba(220,0,80,.2)' }}>{error}</div>}
          {success && <div style={{ fontSize: 12, color: 'var(--gold)', padding: '8px 12px', background: 'rgba(212,175,55,.1)', border: '1px solid rgba(212,175,55,.2)' }}>{success}</div>}

          <button type="submit" disabled={loading} className="bp"
            style={{ marginTop: 4, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
