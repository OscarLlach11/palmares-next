export default function ProfilePage() {
  return (
    <div className="hero">
      <div className="hero-bg">PROFILE</div>
      <div className="eyebrow">— Your Account</div>
      <h1>My <em>Profile</em></h1>
      <p className="hero-sub" style={{ marginTop: 16 }}>
        Sign in to view your profile, stats, and race log.
      </p>
      <button className="bp" style={{ marginTop: 16 }}>Sign In</button>
    </div>
  )
}
