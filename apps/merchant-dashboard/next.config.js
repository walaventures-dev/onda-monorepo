const path = require('path');

const apiUrl = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3333'
).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@onda/shared-ui', '@onda/shared-types', '@onda/shared-utils'],
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};
module.exports = nextConfig;
