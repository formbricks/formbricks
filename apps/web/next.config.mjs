import { withSentryConfig } from "@sentry/nextjs";
import createJiti from "jiti";
import createNextIntlPlugin from "next-intl/plugin";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const jiti = createJiti(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
jiti("@formbricks/lib/env");

/** @type {import('next').NextConfig} */

const getHostname = (url) => {
  const urlObj = new URL(url);
  return urlObj.hostname;
};

const nextConfig = {
  assetPrefix: process.env.ASSET_PREFIX_URL || undefined,
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["@aws-sdk"],
    instrumentationHook: true,
    staleTimes: {
      dynamic: 0,
    },
    outputFileTracingIncludes: {
      "app/api/packages": ["../../packages/js-core/dist/*", "../../packages/surveys/dist/*"],
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
        hostname: "avatars.slack-edge.com",
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
      {
        protocol: "https",
        hostname: "images.unsplash.com",
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
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(mp4|webm|ogg|swf|ogv)$/,
      use: [
        {
          loader: "file-loader",
          options: {
            publicPath: "/_next/static/videos/",
            outputPath: "static/videos/",
            name: "[name].[hash].[ext]",
          },
        },
      ],
    });
    return config;
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
      {
        source: "/environments/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
      {
        source: "/auth/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-src 'self' https://app.cal.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
      {
        source: "/js/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=604800, stale-while-revalidate=3600, stale-if-error=3600",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=UTF-8",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },

      // headers for /api/packages/(.*) -- the api route does not exist, but we still need the headers for the rewrites to work correctly!
      {
        source: "/api/packages/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=604800, stale-while-revalidate=3600, stale-if-error=3600",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=UTF-8",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/packages/website",
        destination: "/js/formbricks.umd.cjs",
      },
      {
        source: "/api/packages/app",
        destination: "/js/formbricks.umd.cjs",
      },
      {
        source: "/api/packages/js",
        destination: "/js/formbricks.umd.cjs",
      },
      {
        source: "/api/packages/surveys",
        destination: "/js/surveys.umd.cjs",
      },
      {
        source: "/api/v1/client/:environmentId/website/environment",
        destination: "/api/v1/client/:environmentId/environment",
      },
      {
        source: "/api/v1/client/:environmentId/app/environment",
        destination: "/api/v1/client/:environmentId/environment",
      },
      {
        source: "/api/v1/client/:environmentId/app/people/:userId",
        destination: "/api/v1/client/:environmentId/identify/people/:userId",
      },
    ];
  },
  env: {
    NEXTAUTH_URL: process.env.WEBAPP_URL,
  },
};

// set custom cache handler
if (process.env.CUSTOM_CACHE_DISABLED !== "1") {
  nextConfig.cacheHandler = require.resolve("./cache-handler.mjs");
}

// set actions allowed origins
if (process.env.WEBAPP_URL) {
  nextConfig.experimental.serverActions = {
    allowedOrigins: [process.env.WEBAPP_URL.replace(/https?:\/\//, "")],
  };
}

// Allow all origins for next/image
nextConfig.images.remotePatterns.push({
  protocol: "https",
  hostname: "**",
});

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

export default withNextIntl(nextConfig);
