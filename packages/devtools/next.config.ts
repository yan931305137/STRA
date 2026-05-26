import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@stra/types', '@stra/core', '@stra/dom', '@stra/react'],
};

export default nextConfig;
