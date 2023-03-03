module.exports = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
    transpilePackages: ["ui"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tailwindui.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};
