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
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'blualliancegroup.com',
        pathname: '/logo/**',
      },
      // 🔧 AGGIUNTO: Supporto immagini Supabase Storage
      {
        protocol: 'https',
        hostname: 'wpzxvwenhjqnwhqowxms.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withPWAConfig(nextConfig);