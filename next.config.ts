import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
    ],
  },
  // Allow large video uploads through the API
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb', // For metadata; actual files go directly to S3
    },
  },
};

export default nextConfig;
