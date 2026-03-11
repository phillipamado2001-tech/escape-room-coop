/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow connecting to the Express/Socket.io server
  async rewrites() {
    return [
      {
        source: "/api/socket/:path*",
        destination: "http://localhost:3001/api/socket/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
