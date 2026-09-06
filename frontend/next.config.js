/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    if (config.output && "trustedTypes" in config.output) {
      delete config.output.trustedTypes;
    }
    return config;
  },
};
module.exports = nextConfig;
