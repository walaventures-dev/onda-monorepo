/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@onda/shared-ui', '@onda/shared-types', '@onda/shared-utils'],
  reactStrictMode: true,
};
module.exports = nextConfig;
