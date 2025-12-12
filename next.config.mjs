import withPWA from 'next-pwa';

const withPWAConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  scope: '/',
  sw: 'sw.js',
  runtimeCaching: [],
  publicExcludes: ['!robots.txt', '!sitemap.xml']
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {}, // ← AGGIUNGI QUESTA RIGA
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'blualliancegroup.com',
        pathname: '/logo/**',
      },
    ],
  },
};

export default withPWAConfig(nextConfig);