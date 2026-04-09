/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'pkbxgeloejmnblwpsuch.supabase.co' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'firstcycling.com' },
      { protocol: 'https', hostname: 'procyclingstats.com' },
    ],
  },
}

module.exports = nextConfig
