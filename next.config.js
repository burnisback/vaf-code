const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js-only packages from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        http2: false,
        undici: false,
      };

      // Force browser condition for module resolution
      config.resolve.conditionNames = ['browser', 'import', 'require', 'default'];

      // Alias undici to empty module
      config.resolve.alias = {
        ...config.resolve.alias,
        undici: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
