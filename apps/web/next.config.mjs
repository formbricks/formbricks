import { withSentryConfig } from "@sentry/nextjs";
import createJiti from "jiti";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const jiti = createJiti(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
jiti("./lib/env");

/** @type {import('next').NextConfig} */

const getHostname = (url) => {
  const urlObj = new URL(url);
  return urlObj.hostname;
};

const nextConfig = {
  assetPrefix: process.env.ASSET_PREFIX_URL || undefined,
  cacheHandler: require.resolve("./cache-handler.js"),
  cacheMaxMemorySize: 0, // disable default in-memory caching
  output: "standalone",
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["@aws-sdk", "@opentelemetry/instrumentation", "pino", "pino-pretty"],
  outputFileTracingIncludes: {
    "app/api/packages": ["../../packages/js-core/dist/*", "../../packages/surveys/dist/*"],
    "/api/auth/**/*": ["../../node_modules/jose/**/*"],
  },
  experimental: {},
  transpilePackages: ["@formbricks/database"],
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
      {
        protocol: "https",
        hostname: "api-iam.eu.intercom.io",
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
    config.resolve.fallback = {
      http: false, // Prevents Next.js from trying to bundle 'http'
      https: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // matching all API routes
        source: "/api/(v1|v2)/client/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cache-Control",
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
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cache-Control",
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
              "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.intercom.io https://*.intercomcdn.com https:; style-src 'self' 'unsafe-inline' https://*.intercomcdn.com https:; img-src 'self' blob: data: https://*.intercom.io https://*.intercomcdn.com data: https:; font-src 'self' data: https://*.intercomcdn.com https:; connect-src 'self' https://*.intercom.io wss://*.intercom.io https://*.intercomcdn.com https:; frame-src 'self' https://*.intercom.io https://app.cal.com https:; media-src 'self' https:; object-src 'self' data: https:; base-uri 'self'; form-action 'self'",
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
      {
        source: "/api/v1/client/:environmentId/identify/people/:userId",
        destination: "/api/v1/client/:environmentId/identify/contacts/:userId",
      },
      {
        source: "/api/v1/client/:environmentId/people/:userId/attributes",
        destination: "/api/v1/client/:environmentId/contacts/:userId/attributes",
      },
      {
        source: "/api/v1/management/people/:id*",
        destination: "/api/v1/management/contacts/:id*",
      },
      {
        source: "/api/v1/management/attribute-classes",
        destination: "/api/v1/management/contact-attribute-keys",
      },
      {
        source: "/api/v1/management/attribute-classes/:id*",
        destination: "/api/v1/management/contact-attribute-keys/:id*",
      },
    ];
  },
  env: {
    NEXTAUTH_URL: process.env.WEBAPP_URL,
  },
};

// set actions allowed origins
if (process.env.WEBAPP_URL) {
  nextConfig.experimental.serverActions = {
    allowedOrigins: [process.env.WEBAPP_URL.replace(/https?:\/\//, "")],
    bodySizeLimit: "2mb",
  };
}

// Allow all origins for next/image
nextConfig.images.remotePatterns.push({
  protocol: "https",
  hostname: "**",
});

const sentryOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "formbricks",
  project: "formbricks-cloud",

  // Only print logs for uploading source maps in CI
  silent: true,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
};

const exportConfig =
  process.env.SENTRY_DSN && process.env.NODE_ENV === "production"
    ? withSentryConfig(nextConfig, sentryOptions)
    : nextConfig;

export default exportConfig;
