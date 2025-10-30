import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.rightmove.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'assets.pipedream.net'
      }
    ],
  },
};

export default nextConfig;
