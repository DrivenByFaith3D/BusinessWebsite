

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Product images pulled from Etsy listings by the shop sync.
      {
        protocol: 'https',
        hostname: 'i.etsystatic.com',
      },
    ],
  },
}

export default nextConfig
