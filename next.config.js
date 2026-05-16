/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["msedge-tts", "ws"],
  },
};

module.exports = nextConfig;
