/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@lmnas/blocks",
    "@lmnas/block-registry",
    "@lmnas/contracts",
    "@lmnas/analytics",
    "@lmnas/integrations",
    "@lmnas/layouts",
    "@lmnas/renderer",
    "@lmnas/seo-engine",
    "@lmnas/testkit"
  ]
};

export default nextConfig;
