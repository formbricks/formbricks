import { createId } from "@paralleldrive/cuid2";
import { withSentryConfig } from "@sentry/nextjs";
import createJiti from "jiti";
import { fileURLToPath } from "node:url";

const jiti = createJiti(fileURLToPath(import.meta.url));

jiti("@formbricks/lib/env");

/** @type {import('next').NextConfig} */

function getHostname(url) {
  const urlObj = new URL(url);
  return urlObj.hostname;
}

const nextConfig = {
  assetPrefix: process.env.ASSET_PREFIX_URL || undefined,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@aws-sdk"],
    instrumentationHook: true,
    outputFileTracingIncludes: {
      "app/api/packages/": ["../../packages/**/*"],
    },
  },
  transpilePackages: ["@formbricks/database", "@formbricks/ee", "@formbricks/ui", "@formbricks/lib"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "app.formbricks.com",
      },
      {
        protocol: "https",
        hostname: "formbricks-cdn.s3.eu-central-1.amazonaws.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/i/:path*",
        destination: "/:path*",
        permanent: false,
      },
      {
        source: "/api/v1/surveys",
        destination: "/api/v1/management/surveys",
        permanent: true,
      },
      {
        source: "/api/v1/responses",
        destination: "/api/v1/management/responses",
        permanent: true,
      },
      {
        source: "/api/v1/me",
        destination: "/api/v1/management/me",
        permanent: true,
      },
      {
        source: "/api/v1/me",
        destination: "/api/v1/management/me",
        permanent: true,
      },
    ];
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
  env: {
    INSTANCE_ID: createId(),
    INTERNAL_SECRET: createId(),
  },
};

// set actions allowed origins
if (process.env.WEBAPP_URL) {
  nextConfig.experimental.serverActions = {
    allowedOrigins: [process.env.WEBAPP_URL.replace(/https?:\/\//, "")],
  };
  nextConfig.images.remotePatterns.push({
    protocol: "https",
    hostname: getHostname(process.env.WEBAPP_URL),
  });
} else {
  // The WEBAPP_URL is not set, so we allow all origins
  nextConfig.images.remotePatterns.push({
    protocol: "https",
    hostname: "**",
  });
}

const sentryOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,

  org: "formbricks",
  project: "formbricks-cloud",
};

const sentryConfig = {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Transpiles SDK to be compatible with IE11 (increases bundle size)
  transpileClientSDK: true,

  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
};

const exportConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions, sentryConfig)
  : nextConfig;

export default exportConfig;
