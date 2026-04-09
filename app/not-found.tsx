import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="hero" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="hero-bg">404</div>
      <div className="eyebrow">— Not Found</div>
      <h1>Page not <em>found.</em></h1>
      <p className="hero-sub" style={{ marginTop: 8 }}>
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="bp" style={{ marginTop: 16, textDecoration: 'none', display: 'inline-block' }}>
        Back to Discover
      </Link>
    </div>
  )
}
