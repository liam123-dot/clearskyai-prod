import type { NextConfig } from "next";
import { withWorkflow} from 'workflow/next'

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
  serverExternalPackages: ['twilio'],
};

export default withWorkflow(nextConfig);
