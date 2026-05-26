import type { NextConfig } from 'next';
import path from 'path';

const straPackagesDir = path.resolve(__dirname, '../../packages');

const straPackages = [
  'types', 'core', 'dom', 'renderer-core', 'renderer-html',
];

const nextConfig: NextConfig = {
  transpilePackages: straPackages.map(p => `@stra/${p}`),
  turbopack: {
    root: path.resolve(__dirname, '../../..'),
  },
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {};
    for (const pkg of straPackages) {
      const pkgSrc = path.join(straPackagesDir, pkg, 'src');
      config.resolve.alias[`@stra/${pkg}$`] = pkgSrc;
    }
    return config;
  },
};

export default nextConfig;
