import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'strikers-match.sfo3.digitaloceanspaces.com',
        pathname: '/**',
      },
    ],
  },
  // Tell Google not to index static build assets (fonts, chunks, images).
  // Fixes "Alternate page with proper canonical tag" on /_next/static/media/*.woff2
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/_next/image/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
