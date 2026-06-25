/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse and mammoth are CommonJS libs used only on the server.
  // Keep them external so Next does not try to bundle them into route handlers.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
