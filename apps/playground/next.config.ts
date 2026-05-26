import type { NextConfig } from 'next';
import path from 'path';

const straPackagesDir = path.resolve(__dirname, '../../packages');

const straPackages = [
  'types', 'core', 'dom', 'react', 'explain', 'diff', 'compiler-ai',
  'ai-sdk', 'ai-layout', 'ai-action', 'devtools', 'time-travel', 'inspect',
  'dsl', 'compiler', 'renderer-html', 'renderer-console', 'ssr', 'persistence',
  'seo', 'a11y', 'analytics', 'graph', 'causality', 'next', 'react-devtools',
  'fs', 'copilot', 'nl-builder', 'agent', 'prompt-runtime', 'cli', 'create-app',
  'storybook', 'vscode', 'figma',
];

const nextConfig: NextConfig = {
  transpilePackages: straPackages.map(p => `@stra/${p}`),
  turbopack: {},
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
