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

      const { data: session } = await supabase.auth.getSession()
      const uid = session.session?.user?.id
      if (uid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('user_id', uid)
          .maybeSingle()

        // FIX: only send to onboarding if onboarding_complete is explicitly FALSE.
        // NULL means the column didn't exist when this account was created (old user)
        // — they should go straight home, not be forced through onboarding.
        // Only brand-new signups get onboarding_complete: false set explicitly.
        if (prof?.onboarding_complete === false) {
          router.push('/onboarding')
        } else {
          router.push('/')
        }
      } else {
        router.push('/')
      }

    } else {
      // Sign up — always goes to onboarding for new accounts
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }

      if (data.user) {
        // Create profile row with onboarding_complete: false so the onboarding
        // guard above routes them correctly if they sign out and back in mid-flow
        await supabase.from('profiles').upsert({
          user_id: data.user.id,
          onboarding_complete: false,
        }, { onConflict: 'user_id' })
      }

      if (data.session) {
        // Email confirmation disabled — session available immediately → go to onboarding
        router.push('/onboarding')
      } else {
        // Email confirmation enabled — tell them to check their inbox
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
