import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@lmnas/integrations', '@lmnas/renderer', '@lmnas/seo-engine', '@lmnas/contracts', '@lmnas/block-registry', '@lmnas/blocks']
};

export default nextConfig;
