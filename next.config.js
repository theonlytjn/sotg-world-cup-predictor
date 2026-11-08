/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'crests.football-data.org' },
      { protocol: 'https', hostname: '**.football-data.org' },
    ],
  },
  // Premier League season predictor (static app in public/pl)
  async rewrites() {
    return [
      { source: '/pl', destination: '/pl/index.html' },
      { source: '/ucl', destination: '/ucl/index.html' },
    ];
  },
  // The World Cup game moved from the site root to /wc — keep old links (and shared league invites) working
  async redirects() {
    const moved = ['predict', 'awards', 'tournament', 'fixtures', 'leaderboard', 'leagues', 'rules', 'me', 'poll', 'admin', 'login', 'onboarding'];
    return moved.flatMap((p) => [
      { source: `/${p}`, destination: `/wc/${p}`, permanent: false },
      { source: `/${p}/:path*`, destination: `/wc/${p}/:path*`, permanent: false },
    ]);
  },
};
module.exports = nextConfig;
