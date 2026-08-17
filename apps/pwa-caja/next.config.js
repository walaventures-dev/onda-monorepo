/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@onda/shared-ui', '@onda/shared-types', '@onda/shared-utils'],
  reactStrictMode: true,
  allowedDevOrigins: [
    '**.devtunnels.ms',
    '**.ngrok-free.app',
    '**.ngrok-free.dev',
    '**.ngrok.io',
    '**.ngrok.app',
    '192.168.40.5',
  ],
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:3333/api/:path*' }];
  },
};
module.exports = nextConfig;
