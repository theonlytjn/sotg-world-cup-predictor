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
    return [{ source: '/pl', destination: '/pl/index.html' }];
  },
};
module.exports = nextConfig;
