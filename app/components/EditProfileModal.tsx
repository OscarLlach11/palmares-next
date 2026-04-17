'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/context/UserContext'

interface Props {
  onClose: () => void
}

function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c', '#00594a', '#c0392b', '#9a8430', '#4527a0', '#00838f', '#6d4c41', '#1a4db3']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

function riderInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function formatRiderName(name: string) {
  if (!name) return ''
  return name.split(' ').map(w => w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w).join(' ')
}

const STAGE_RACE_TYPES = ['Grand Tour', 'Stage Race']

export default function EditProfileModal({ onClose }: Props) {
  const { user, profile, refreshProfile } = useUser()

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [favRiders, setFavRiders] = useState<any[]>((profile?.fav_riders || [null, null, null, null]).slice(0, 4))
  const [favRaceSlug, setFavRaceSlug] = useState(profile?.fav_race_slug || '')
  const [favRaceYear, setFavRaceYear] = useState<number | null>(profile?.fav_race_year || null)
  const [favRaceStageNum, setFavRaceStageNum] = useState<number | null>((profile as any)?.fav_race_stage_num || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Rider picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSlot, setPickerSlot] = useState(0)
  const [riderQuery, setRiderQuery] = useState('')
  const [riderResults, setRiderResults] = useState<any[]>([])
  const [riderSearching, setRiderSearching] = useState(false)

  // Race picker state
  const [racePickerOpen, setRacePickerOpen] = useState(false)
  const [raceQuery, setRaceQuery] = useState('')
  const [raceResults, setRaceResults] = useState<any[]>([])
  const [selectedRace, setSelectedRace] = useState<any>(null)
  const [raceYears, setRaceYears] = useState<number[]>([])
  // Stage picker state (step 3 of race picker for stage races)
  const [stagePickerActive, setStagePickerActive] = useState(false)
  const [stageOptions, setStageOptions] = useState<any[]>([])
  const [stagesLoading, setStagesLoading] = useState(false)

  // Load existing fav race info when picker opens
  useEffect(() => {
    if (!racePickerOpen || !favRaceSlug) return
    supabase.from('races').select('slug,race_name,gradient,race_type').eq('slug', favRaceSlug).maybeSingle()
      .then(({ data }) => { if (data) setSelectedRace(data) })
    supabase.from('race_results').select('year').eq('slug', favRaceSlug).order('year', { ascending: false })
      .then(({ data }) => setRaceYears((data || []).map((r: any) => r.year)))
    // If there's already a year + stage, show the stage picker in resumed state
    if (favRaceYear && favRaceStageNum) setStagePickerActive(true)
  }, [racePickerOpen])

  // Rider search
  useEffect(() => {
    if (!pickerOpen || riderQuery.length < 2) { setRiderResults([]); return }
    const timer = setTimeout(async () => {
      setRiderSearching(true)
      const { data } = await supabase.from('startlists')
        .select('rider_name,image_url,team_name,nationality')
        .ilike('rider_name', `%${riderQuery}%`)
        .order('year', { ascending: false })
        .limit(20)
      const seen = new Set()
      const unique = (data || []).filter((r: any) => {
        if (seen.has(r.rider_name)) return false
        seen.add(r.rider_name); return true
      })
      setRiderResults(unique)
      setRiderSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [riderQuery, pickerOpen])

  // Race search
  useEffect(() => {
    if (!racePickerOpen || raceQuery.length < 2) {
      if (raceQuery.length < 2) setRaceResults([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('races').select('slug,race_name,gradient,flag,race_type').ilike('race_name', `%${raceQuery}%`).limit(15)
      setRaceResults(data || [])
    }, 250)
    return () => clearTimeout(timer)
  }, [raceQuery, racePickerOpen])

  // Load stages when a year is selected for a stage race
  async function loadStages(slug: string, year: number) {
    setStagesLoading(true)
    setStageOptions([])
    const { data } = await supabase
      .from('stage_results')
      .select('stage_num, stage_label, winner, departure, arrival, stage_type')
      .eq('race_slug', slug)
      .eq('year', year)
      .order('stage_num')
    setStageOptions(data || [])
    setStagesLoading(false)
  }

  function openRiderPicker(slot: number) {
    setPickerSlot(slot)
    setRiderQuery('')
    setRiderResults([])
    setPickerOpen(true)
  }

  function selectRider(rider: any) {
    const updated = [...favRiders]
    updated[pickerSlot] = {
      name: rider.rider_name,
      imageUrl: rider.image_url && rider.image_url !== 'none' ? rider.image_url : null,
    }
    setFavRiders(updated)
    setPickerOpen(false)
  }

  function removeRider(slot: number) {
    const updated = [...favRiders]
    updated[slot] = null
    setFavRiders(updated)
  }

  async function selectFavRace(race: any) {
    setSelectedRace(race)
    setRaceQuery('')
    setRaceResults([])
    setFavRaceSlug(race.slug)
    setFavRaceYear(null)
    setFavRaceStageNum(null)
    setStagePickerActive(false)
    setStageOptions([])
    const { data } = await supabase.from('race_results').select('year').eq('slug', race.slug).order('year', { ascending: false })
    setRaceYears((data || []).map((r: any) => r.year))
  }

  async function selectFavYear(year: number) {
    setFavRaceYear(year)
    setFavRaceStageNum(null)
    // If this is a stage race, kick off stage loading
    if (selectedRace && STAGE_RACE_TYPES.includes(selectedRace.race_type)) {
      setStagePickerActive(true)
      await loadStages(selectedRace.slug, year)
    } else {
      setStagePickerActive(false)
      setStageOptions([])
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2MB'); return }
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setUploadingAvatar(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', user.id)
    await refreshProfile()
    setUploadingAvatar(false)
    showToast('Photo updated!')
    e.target.value = ''
  }

  async function save() {
    if (!user) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('profiles').update({
      display_name: displayName.trim() || null,
      fav_riders: favRiders,
      fav_race_slug: favRaceSlug || null,
      fav_race_year: favRaceYear || null,
      fav_race_stage_num: favRaceStageNum || null,
    }).eq('user_id', user.id)
    if (err) { setError(err.message); setSaving(false); return }
    await refreshProfile()
    setSaving(false)
    showToast('Profile saved!')
    onClose()
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  // Friendly summary of the current fav race selection
  function favRaceSummary() {
    if (!favRaceSlug) return null
    let text = favRaceSlug
    if (selectedRace) text = selectedRace.race_name
    if (favRaceYear) text += ` · ${favRaceYear}`
    if (favRaceStageNum !== null) {
      const stg = stageOptions.find(s => s.stage_num === favRaceStageNum)
      const label = favRaceStageNum === 0 ? 'Prologue' : stg?.stage_label ? `Stage ${stg.stage_label}` : `Stage ${favRaceStageNum}`
      text += ` · ${label}`
    }
    return text
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: 'var(--gold)' }}>Edit Profile</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: 28 }}>
          {/* Avatar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Profile Photo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (profile?.display_name || 'C').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <label style={{ cursor: 'pointer' }}>
                <span className="bs" style={{ fontSize: 10, padding: '6px 14px', display: 'inline-block' }}>
                  {uploadingAvatar ? 'Uploading…' : 'Change Photo'}
                </span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </label>
            </div>
          </div>

          {/* Display name */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Display Name</div>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none' }}
            />
          </div>

          {/* Favourite Riders */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, color: 'var(--gold)', marginBottom: 12 }}>Favourite Riders</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {favRiders.map((rider: any, i: number) => {
                const name = typeof rider === 'string' ? rider : rider?.name
                const imgUrl = typeof rider === 'object' ? rider?.imageUrl : null
                if (name) {
                  const col = riderColor(name)
                  const ini = riderInitials(name)
                  return (
                    <div key={i} style={{ position: 'relative', width: 90, aspectRatio: '2/3', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                      {imgUrl
                        ? <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <div style={{ width: '100%', height: '100%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#fff' }}>{ini}</div>}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '3px 5px', fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {formatRiderName(name)}
                      </div>
                      <button onClick={() => removeRider(i)}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', color: '#fff', width: 18, height: 18, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✕</button>
                      <button onClick={() => openRiderPicker(i)}
                        style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer' }} />
                    </div>
                  )
                }
                return (
                  <div key={i} onClick={() => openRiderPicker(i)}
                    style={{ width: 90, aspectRatio: '2/3', background: 'var(--bg)', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, color: 'var(--border-light)' }}>+</div>
                    <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: 1 }}>RIDER {i + 1}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Favourite Race */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, color: 'var(--gold)', marginBottom: 12 }}>Favourite Race</div>

            {!racePickerOpen ? (
              <div
                onClick={() => setRacePickerOpen(true)}
                style={{ padding: '10px 14px', background: 'var(--bg)', border: '1px dashed var(--border)', cursor: 'pointer', fontSize: 12, color: favRaceSlug ? 'var(--fg)' : 'var(--muted)' }}
              >
                {favRaceSummary() || '+ Choose Favourite Race'}
              </div>
            ) : (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 16 }}>

                {/* ── Step 1: Race search ── */}
                {!selectedRace && (
                  <>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Search Race</div>
                    <input
                      autoFocus
                      placeholder="Search race…"
                      value={raceQuery}
                      onChange={e => setRaceQuery(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', marginBottom: 8 }}
                    />
                    {raceResults.map(r => (
                      <div
                        key={r.slug}
                        onClick={() => selectFavRace(r)}
                        style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}
                      >
                        <div style={{ width: 24, height: 24, background: r.gradient, flexShrink: 0 }} />
                        <span>{r.race_name}</span>
                        {STAGE_RACE_TYPES.includes(r.race_type) && (
                          <span style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase' }}>Stage Race</span>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* ── Step 2: Year selection ── */}
                {selectedRace && (
                  <>
                    {/* Selected race header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--card-bg)', border: `1px solid ${favRaceYear ? 'var(--gold)' : 'var(--border)'}`, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 20, height: 20, background: selectedRace.gradient, flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>{selectedRace.race_name}</span>
                      </div>
                      <button
                        onClick={() => { setSelectedRace(null); setRaceQuery(''); setFavRaceYear(null); setFavRaceStageNum(null); setStagePickerActive(false) }}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}
                      >
                        Change
                      </button>
                    </div>

                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                      Select Year
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                      {raceYears.map(y => (
                        <button
                          key={y}
                          onClick={() => selectFavYear(y)}
                          style={{
                            padding: '4px 10px', fontSize: 11,
                            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, cursor: 'pointer',
                            background: favRaceYear === y ? 'var(--gold)' : 'var(--card-bg)',
                            color: favRaceYear === y ? '#000' : 'var(--fg)',
                            border: `1px solid ${favRaceYear === y ? 'var(--gold)' : 'var(--border)'}`,
                            transition: 'all .1s',
                          }}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Step 3: Stage selection (stage races only) ── */}
                {stagePickerActive && favRaceYear && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)' }}>
                        Select Stage <span style={{ color: 'var(--border-light)', marginLeft: 6 }}>(optional)</span>
                      </div>
                      {favRaceStageNum !== null && (
                        <button
                          onClick={() => setFavRaceStageNum(null)}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 10 }}
                        >
                          Clear stage
                        </button>
                      )}
                    </div>

                    {stagesLoading ? (
                      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0' }}>Loading stages…</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)' }}>
                        {stageOptions.map((s: any) => {
                          const label = s.stage_num === 0 ? 'Prologue' : s.stage_label ? `Stage ${s.stage_label}` : `Stage ${s.stage_num}`
                          const isSelected = favRaceStageNum === s.stage_num
                          const isTT = s.stage_type && (s.stage_type.toLowerCase().includes('tt') || s.stage_type.toLowerCase().includes('time trial'))
                          return (
                            <div
                              key={s.stage_num}
                              onClick={() => setFavRaceStageNum(isSelected ? null : s.stage_num)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                                background: isSelected ? 'rgba(232,200,74,.08)' : 'var(--card-bg)',
                                borderLeft: `3px solid ${isSelected ? 'var(--gold)' : 'transparent'}`,
                                cursor: 'pointer', transition: 'all .1s',
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#111' }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--card-bg)' }}
                            >
                              {/* Stage number */}
                              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: isSelected ? 'var(--gold)' : 'var(--muted)', width: 56, flexShrink: 0 }}>
                                {label}
                              </span>

                              {/* Route */}
                              <span style={{ fontSize: 10, color: 'var(--fg)', opacity: 0.7, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.departure && s.arrival ? `${s.departure} → ${s.arrival}` : s.departure || s.arrival || ''}
                              </span>

                              {/* TT badge */}
                              {isTT && (
                                <span style={{ fontSize: 8, letterSpacing: 1.5, color: '#a78bfa', border: '1px solid #a78bfa', padding: '1px 5px', flexShrink: 0 }}>TT</span>
                              )}

                              {/* Winner */}
                              {s.winner && (
                                <span style={{ fontSize: 10, color: isSelected ? 'var(--gold)' : 'var(--muted)', flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  🏆 {s.winner}
                                </span>
                              )}

                              {/* Checkmark */}
                              {isSelected && (
                                <span style={{ color: 'var(--gold)', fontSize: 12, flexShrink: 0 }}>✓</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => setRacePickerOpen(false)} className="bs" style={{ fontSize: 9, marginTop: 16, padding: '4px 10px' }}>
                  Done
                </button>
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#e05', marginBottom: 12, padding: '8px 12px', background: 'rgba(220,0,80,.1)', border: '1px solid rgba(220,0,80,.2)' }}>
              {error}
            </div>
          )}

          <button onClick={save} disabled={saving} className="bp" style={{ width: '100%', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        {toast && (
          <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: '#000', padding: '8px 20px', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, zIndex: 700 }}>
            {toast}
          </div>
        )}
      </div>

      {/* Rider picker sub-modal */}
      {pickerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setPickerOpen(false) }}
        >
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, marginBottom: 14, color: 'var(--gold)' }}>
              Pick Rider {pickerSlot + 1}
            </div>
            <input
              autoFocus
              value={riderQuery}
              onChange={e => setRiderQuery(e.target.value)}
              placeholder="Search rider name…"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', padding: '10px 14px', fontSize: 13, outline: 'none', marginBottom: 8 }}
            />
            {riderSearching && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Searching…</div>}
            <div className="picker-list">
              {riderResults.map(r => (
                <div
                  key={r.rider_name}
                  onClick={() => selectRider(r)}
                  className="picker-item"
                >
                  {r.image_url && r.image_url !== 'none'
                    ? <img src={r.image_url} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <div style={{ width: 32, height: 44, background: riderColor(r.rider_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: '#fff', flexShrink: 0 }}>
                        {riderInitials(r.rider_name)}
                      </div>}
                  <div>
                    <div style={{ fontSize: 13 }}>{formatRiderName(r.rider_name)}</div>
                    {r.team_name && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.team_name}</div>}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setPickerOpen(false)} className="bs" style={{ fontSize: 9, marginTop: 12, padding: '4px 10px' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
