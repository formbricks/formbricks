/** @type {import('next').NextConfig} */
var path = require("path");

const nextConfig = {
  reactStrictMode: false,
  serverRuntimeConfig: {
    // Will only be available on the server side
    secret: process.env.SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL,
    mailFrom: process.env.MAIL_FROM,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    smtpSecureEnabled: process.env.SMTP_SECURE_ENABLED,
  },
  publicRuntimeConfig: {
    // Will be available on both server and client
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
