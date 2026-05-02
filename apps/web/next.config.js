/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },

  webpack(config, { dev }) {
    config.resolve.fallback = { fs: false };
    // Disk pack cache under `.next/cache/webpack` can go stale on Windows (AV/OneDrive/git clean),
    // yielding ENOENT on *.pack.gz and 404s for `/_next/static/*` until `.next` is removed.
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  },
};

module.exports = nextConfig;
