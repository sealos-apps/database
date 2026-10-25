/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');
const path = require('path');
const nextConfig = {
  i18n,
  output: 'standalone',
  reactStrictMode: false,
  compress: true,
  webpack: (config, { isServer }) => {
    config.module.rules = config.module.rules.concat([
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        use: ['@svgr/webpack']
      }
    ]);
    config.plugins = [...config.plugins];
    return config;
  },
  transpilePackages: [
    '@labring/sealos-chakra-ui',
    '@labring/sealos-desktop-sdk',
    '@labring/sealos-driver-sdk',
    '@labring/sealos-shared-sdk',
    '@labring/sealos-gtm-sdk'
  ],
  experimental: {
    // this includes files from the workspace root one directory up
    outputFileTracingRoot: path.join(__dirname, '../'),
    instrumentationHook: true
  },
  async redirects() {
    return [{ source: '/', destination: '/dbs', permanent: false }];
  },
  async rewrites() {
    return [
      {
        source: '/api/v2alpha/docs',
        destination: '/doc/v2alpha'
      },
      {
        source: '/api/v2alpha/openapi.json',
        destination: '/api/v2alpha/openapi'
      }
    ];
  }
};

module.exports = nextConfig;
