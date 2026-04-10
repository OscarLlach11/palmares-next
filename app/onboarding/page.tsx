'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Race = { slug: string; race_name: string; flag: string }

const STEPS = ['Favourite Riders', 'Favourite Race', 'Log a Race']
const HALF_STARS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const RATING_LABELS: Record<string, string> = {
  '0.5': 'Just Riding', '1': 'Unwatchable', '1.5': 'Very Poor',
  '2': 'Disappointing', '2.5': 'Decent', '3': 'Good', '3.5': 'Very Good',
  '4': 'Great', '4.5': 'Superb', '5': 'All-Time Classic',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  // Step 1 — riders
  const [riderQuery, setRiderQuery] = useState('')
  const [riderResults, setRiderResults] = useState<string[]>([])
  const [selectedRiders, setSelectedRiders] = useState<string[]>([])

  // Step 2 — race
  const [raceQuery, setRaceQuery] = useState('')
  const [raceResults, setRaceResults] = useState<Race[]>([])
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [availYears, setAvailYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  // Step 3 — log a race
  const [logRaceQuery, setLogRaceQuery] = useState('')
  const [logRaceResults, setLogRaceResults] = useState<Race[]>([])
  const [logSelectedRace, setLogSelectedRace] = useState<Race | null>(null)
  const [logAvailYears, setLogAvailYears] = useState<number[]>([])
  const [logYear, setLogYear] = useState<number | null>(null)
  const [logRating, setLogRating] = useState<number>(0)
  const [logReview, setLogReview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return }
      setUserId(data.session.user.id)
    })
  }, [router])

  // Search riders
  useEffect(() => {
    if (riderQuery.length < 2) { setRiderResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('rider_wins').select('rider_name').ilike('rider_name', `%${riderQuery}%`).limit(20)
      const unique = [...new Set((data || []).map((r: any) => r.rider_name))]
      setRiderResults(unique)
    }, 300)
    return () => clearTimeout(timer)
  }, [riderQuery])

  // Search races (step 2)
  useEffect(() => {
    if (raceQuery.length < 2) { setRaceResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('races').select('slug,race_name,flag').ilike('race_name', `%${raceQuery}%`).limit(15)
      setRaceResults(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [raceQuery])

  // Load years for step 2 race
  useEffect(() => {
    if (!selectedRace) return
    supabase.from('race_results').select('year').eq('slug', selectedRace.slug).order('year', { ascending: false })
      .then(({ data }) => { setAvailYears((data || []).map((r: any) => r.year)); setSelectedYear(null) })
  }, [selectedRace])

  // Search races (step 3)
  useEffect(() => {
    if (logRaceQuery.length < 2) { setLogRaceResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('races').select('slug,race_name,flag').ilike('race_name', `%${logRaceQuery}%`).limit(15)
      setLogRaceResults(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [logRaceQuery])

  // Load years for step 3 race
  useEffect(() => {
    if (!logSelectedRace) return
    supabase.from('race_results').select('year').eq('slug', logSelectedRace.slug).order('year', { ascending: false })
      .then(({ data }) => { setLogAvailYears((data || []).map((r: any) => r.year)); setLogYear(null) })
  }, [logSelectedRace])

  function toggleRider(name: string) {
    setSelectedRiders(prev => prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name])
  }

  async function saveAndFinish() {
    if (!userId) return
    setSaving(true)
    setError('')
    const profileUpdate: Record<string, any> = { onboarding_complete: true }
    if (selectedRiders.length > 0) profileUpdate.fav_riders = selectedRiders
    if (selectedRace) profileUpdate.fav_race_slug = selectedRace.slug
    if (selectedYear) profileUpdate.fav_race_year = selectedYear
    await supabase.from('profiles').update(profileUpdate).eq('user_id', userId)
    if (logSelectedRace && logYear && logRating > 0) {
      await supabase.from('race_logs').upsert({
        user_id: userId, slug: logSelectedRace.slug, year: logYear,
        rating: logRating, review: logReview || null,
      }, { onConflict: 'user_id,slug,year' })
    }
    setSaving(false)
    router.push('/')
  }

  async function skipToHome() {
    if (!userId) return
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('user_id', userId)
    router.push('/')
  }

  const progressPct = (step / STEPS.length) * 100

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 4 }}>PALMARÈS</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>Let's set up your profile</div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: i === step ? 'var(--gold)' : i < step ? 'var(--fg)' : 'var(--muted)' }}>{s}</div>
            ))}
          </div>
          <div style={{ height: 2, background: 'var(--border)', borderRadius: 1 }}>
            <div style={{ height: '100%', background: 'var(--gold)', borderRadius: 1, width: `${progressPct}%`, transition: 'width .3s' }} />
          </div>
        </div>

        {/* Step 1 — Riders */}
        {step === 0 && (
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>Who are your favourite riders?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Select at least one. You can change this later.</div>
            <input placeholder="Search rider name…" value={riderQuery} onChange={e => setRiderQuery(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', marginBottom: 8 }} />
            {riderResults.length > 0 && (
              <div style={{ border: '1px solid var(--border)', marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
                {riderResults.map(name => (
                  <div key={name} onClick={() => { toggleRider(name); setRiderQuery(''); setRiderResults([]) }}
                    style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', background: selectedRiders.includes(name) ? 'rgba(232,200,74,.1)' : 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
                    {name}
                  </div>
                ))}
              </div>
            )}
            {selectedRiders.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {selectedRiders.map(name => (
                  <span key={name} onClick={() => toggleRider(name)}
                    style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(232,200,74,.1)', border: '1px solid var(--gold)', cursor: 'pointer', letterSpacing: 1 }}>
                    {name} ×
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setStep(1)} disabled={selectedRiders.length === 0} className="bp"
                style={{ flex: 1, opacity: selectedRiders.length === 0 ? 0.4 : 1, cursor: selectedRiders.length === 0 ? 'not-allowed' : 'pointer' }}>Continue</button>
              <button onClick={() => setStep(1)} className="bs" style={{ padding: '10px 20px' }}>Skip</button>
            </div>
          </div>
        )}

        {/* Step 2 — Favourite Race */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>What's your favourite race?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Pick a race and edition.</div>
            {!selectedRace ? (
              <>
                <input placeholder="Search race name…" value={raceQuery} onChange={e => setRaceQuery(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', marginBottom: 8 }} />
                {raceResults.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
                    {raceResults.map(r => (
                      <div key={r.slug} onClick={() => { setSelectedRace(r); setRaceQuery(''); setRaceResults([]) }}
                        style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                        <span>{r.flag}</span><span>{r.race_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--gold)', marginBottom: 12 }}>
                  <span style={{ fontSize: 13 }}>{selectedRace.flag} {selectedRace.race_name}</span>
                  <button onClick={() => { setSelectedRace(null); setAvailYears([]); setSelectedYear(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Change</button>
                </div>
                {availYears.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Select Year</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {availYears.map(y => (
                        <button key={y} onClick={() => setSelectedYear(y)}
                          style={{ padding: '5px 12px', fontSize: 12, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, cursor: 'pointer', background: selectedYear === y ? 'var(--gold)' : 'var(--card-bg)', color: selectedYear === y ? '#000' : 'var(--fg)', border: `1px solid ${selectedYear === y ? 'var(--gold)' : 'var(--border)'}` }}>
                          {y}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(2)} disabled={!selectedRace || !selectedYear} className="bp"
                style={{ flex: 1, opacity: (!selectedRace || !selectedYear) ? 0.4 : 1, cursor: (!selectedRace || !selectedYear) ? 'not-allowed' : 'pointer' }}>Continue</button>
              <button onClick={() => setStep(2)} className="bs" style={{ padding: '10px 20px' }}>Skip</button>
            </div>
          </div>
        )}

        {/* Step 3 — Log a Race */}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>Log your first race</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Rate a race you've watched.</div>
            {!logSelectedRace ? (
              <>
                <input placeholder="Search race name…" value={logRaceQuery} onChange={e => setLogRaceQuery(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', marginBottom: 8 }} />
                {logRaceResults.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
                    {logRaceResults.map(r => (
                      <div key={r.slug} onClick={() => { setLogSelectedRace(r); setLogRaceQuery(''); setLogRaceResults([]) }}
                        style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                        <span>{r.flag}</span><span>{r.race_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--gold)', marginBottom: 12 }}>
                  <span style={{ fontSize: 13 }}>{logSelectedRace.flag} {logSelectedRace.race_name}</span>
                  <button onClick={() => { setLogSelectedRace(null); setLogAvailYears([]); setLogYear(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Change</button>
                </div>
                {logAvailYears.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Select Year</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                      {logAvailYears.map(y => (
                        <button key={y} onClick={() => setLogYear(y)}
                          style={{ padding: '5px 12px', fontSize: 12, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, cursor: 'pointer', background: logYear === y ? 'var(--gold)' : 'var(--card-bg)', color: logYear === y ? '#000' : 'var(--fg)', border: `1px solid ${logYear === y ? 'var(--gold)' : 'var(--border)'}` }}>
                          {y}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {logYear && (
                  <>
                    <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Rating</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {HALF_STARS.map(n => (
                        <button key={n} onClick={() => setLogRating(logRating === n ? 0 : n)}
                          style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', background: logRating === n ? 'var(--gold)' : 'var(--card-bg)', color: logRating === n ? '#000' : 'var(--fg)', border: `1px solid ${logRating === n ? 'var(--gold)' : 'var(--border)'}`, transition: 'all .15s' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {logRating > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 12 }}>{RATING_LABELS[String(logRating)]}</div>
                    )}
                    <textarea placeholder="Write a short review (optional)…" value={logReview} onChange={e => setLogReview(e.target.value)} rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                  </>
                )}
              </div>
            )}
            {error && <div style={{ fontSize: 12, color: '#e05', marginTop: 8 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={saveAndFinish} disabled={saving || !logSelectedRace || !logYear || logRating === 0} className="bp"
                style={{ flex: 1, opacity: (saving || !logSelectedRace || !logYear || logRating === 0) ? 0.4 : 1, cursor: (saving || !logSelectedRace || !logYear || logRating === 0) ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Finish'}
              </button>
              <button onClick={skipToHome} className="bs" style={{ padding: '10px 20px' }}>Skip</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
