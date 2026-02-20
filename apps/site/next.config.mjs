/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@lmnas/blocks",
    "@lmnas/block-registry",
    "@lmnas/contracts",
    "@lmnas/integrations",
    "@lmnas/renderer",
    "@lmnas/seo-engine",
    "@lmnas/testkit"
  ]
};

export default nextConfig;
