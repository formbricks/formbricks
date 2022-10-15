/** @type {import('next').NextConfig} */
var path = require("path");

const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/forms/",
        permanent: false,
      },
    ];
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve.alias["react"] = path.resolve("./node_modules/react");
    // Important: return the modified config
    return config;
  },
};

module.exports = nextConfig;
