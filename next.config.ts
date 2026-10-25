import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
