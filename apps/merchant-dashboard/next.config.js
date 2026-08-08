/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@onda/shared-ui', '@onda/shared-types', '@onda/shared-utils'],
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:3333/api/:path*' }];
  },
};
module.exports = nextConfig;
