/** @type {import('next').NextConfig} */

const path = require("path");
const Dotenv = require("dotenv-webpack");

const rootPath = path.join(__dirname, "..", "..");

const { createId } = require("@paralleldrive/cuid2");

const nextConfig = {
  experimental: {
    appDir: true,
  },
  output: "standalone",
  transpilePackages: ["@formbricks/database", "@formbricks/ee", "@formbricks/ui", "@formbricks/lib"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/v1/client/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
      {
        // matching all API routes
        source: "/api/capture/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.plugins.push(
      new Dotenv({
        path: path.resolve(rootPath, ".env"),
      })
    );
    return config;
  },
  env: {
    INSTANCE_ID: createId(),
  },
};

module.exports = nextConfig;
