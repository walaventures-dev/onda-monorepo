const path = require('path');
const fs = require('fs');

/** Next solo lee .env en este app dir; las vars públicas viven en la raíz del monorepo. */
function publicEnvFromRoot() {
  const envPath = path.join(__dirname, '../../.env');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\n/)) {
    const line = raw.trim();
    if (!line.startsWith('NEXT_PUBLIC_')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return out;
}

const publicEnv = publicEnvFromRoot();

const apiUrl = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3333'
).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  env: publicEnv,
  transpilePackages: ['@onda/shared-ui', '@onda/shared-types', '@onda/shared-utils'],
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};
module.exports = nextConfig;
