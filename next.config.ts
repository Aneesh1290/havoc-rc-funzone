import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/checkout.html',
        destination: '/checkout',
      },
      {
        source: '/success',
        destination: '/success.html',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'havocrcfunzone.com',
          },
        ],
        destination: 'https://havocrcfunzone.in/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.havocrcfunzone.com',
          },
        ],
        destination: 'https://havocrcfunzone.in/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.havocrcfunzone.in',
          },
        ],
        destination: 'https://havocrcfunzone.in/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
