import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/landing",
      },
    ];
  },
};

export default nextConfig;
