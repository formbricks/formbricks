import { withSentryConfig } from "@sentry/nextjs";
import createJiti from "jiti";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const jiti = createJiti(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
jiti("./lib/env");

/** @type {import('next').NextConfig} */

const nextConfig = {
  assetPrefix: process.env.ASSET_PREFIX_URL || undefined,
  basePath: process.env.BASE_PATH || undefined,
  output: "standalone",
  poweredByHeader: false,
  // Enable source maps only when uploading to Sentry (CI/production); skip for faster local builds
  productionBrowserSourceMaps: !!process.env.SENTRY_AUTH_TOKEN,
  serverExternalPackages: [
    "@aws-sdk",
    "@opentelemetry/api",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/exporter-metrics-otlp-http",
    "@opentelemetry/exporter-prometheus",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/instrumentation",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/semantic-conventions",
    "@prisma/instrumentation",
    "pino",
    "pino-pretty",
    "pino-opentelemetry-transport",
  ],
  outputFileTracingIncludes: {
    "/api/auth/**/*": ["../../node_modules/jose/**/*"],
    // pino loads transport code in worker threads via dynamic require() — the file tracer
    // only traces static imports and misses these runtime-loaded files.
    // Include the full pino package (worker.js needs transport-stream.js, etc.)
    // and its transport targets with their dependencies.
    "/*": [
      "../../node_modules/pino/**/*",
      "../../node_modules/pino-opentelemetry-transport/**/*",
      "../../node_modules/pino-abstract-transport/**/*",
      "../../node_modules/otlp-logger/**/*",
    ],
  },
  turbopack: {},
  experimental: {},
  transpilePackages: ["@formbricks/database"],
  images: {
    // Optimize image processing to reduce CPU time and prevent timeouts
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Removed 3840 to avoid processing huge images
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Standard sizes for smaller images
    formats: ["image/webp"], // WebP is faster to process and smaller than JPEG/PNG
    minimumCacheTTL: 60, // Cache optimized images for at least 60 seconds
    dangerouslyAllowSVG: true, // Allow SVG images
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
      // Redirect old project URLs to new workspace URLs
      {
        source: "/environments/:environmentId/project/:path*",
        destination: "/environments/:environmentId/workspace/:path*",
        permanent: true,
      },
      {
        source: "/organizations/:organizationId/projects/new/:path*",
        destination: "/organizations/:organizationId/workspaces/new/:path*",
        permanent: true,
      },
      {
        source: "/projects/:projectId",
        destination: "/workspaces/:projectId",
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
    const isProduction = process.env.NODE_ENV === "production";
    const scriptSrcUnsafeEval = isProduction ? "" : " 'unsafe-eval'";

    const cspBase = `default-src 'self'; script-src 'self' 'unsafe-inline'${scriptSrcUnsafeEval} https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' blob: data: http://localhost:9000 https:; font-src 'self' data: https:; connect-src 'self' http://localhost:9000 https: wss:; frame-src 'self' https://app.cal.com https:; media-src 'self' https:; object-src 'self' data: https:; base-uri 'self'; form-action 'self'`;

    return [
      {
        // Apply X-Frame-Options and restricted frame-ancestors to all routes except those starting with /s/ or /c/
        source: "/((?!s/|c/).*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: `${cspBase}; frame-ancestors 'self'`,
          },
        ],
      },
      {
        // Allow surveys (/s/*) and contact survey links (/c/*) to be embedded in iframes on any domain
        // Note: These routes need frame-ancestors * to support embedding surveys in customer websites
        source: "/(s|c)/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `${cspBase}; frame-ancestors *`,
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
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/js/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=3600, s-maxage=2592000, stale-while-revalidate=3600, stale-if-error=86400",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=UTF-8",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },
      // Favicon files - long cache since they rarely change
      {
        source: "/favicon/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, s-maxage=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      // Root favicon.ico - long cache
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, s-maxage=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      // SVG files (icons, logos) - long cache since they're usually static
      {
        source: "/(.*)\\.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, s-maxage=31536000, immutable",
          },
          {
            key: "Content-Type",
            value: "image/svg+xml",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      // Image backgrounds - medium cache (might update more frequently)
      {
        source: "/image-backgrounds/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },
      // Video files - long cache since they're large and expensive to transfer
      {
        source: "/video/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, s-maxage=31536000, stale-while-revalidate=604800",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Accept-Ranges",
            value: "bytes",
          },
        ],
      },
      // Animated backgrounds (4K videos) - very long cache since they're large and immutable
      {
        source: "/animated-bgs/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, s-maxage=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Accept-Ranges",
            value: "bytes",
          },
        ],
      },
      // CSV templates - shorter cache since they might update with feature changes
      {
        source: "/sample-csv/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
          },
          {
            key: "Content-Type",
            value: "text/csv",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      // Web manifest and browser config files - medium cache
      {
        source: "/(site\\.webmanifest|browserconfig\\.xml)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      // Optimize caching for other static assets in public folder (fallback)
      {
        source: "/(images|fonts|icons)/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, s-maxage=31536000, immutable",
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
    NEXTAUTH_URL: process.env.NEXTAUTH_URL, // TODO: Remove this once we have a proper solution for the base path
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
  project: "formbricks-cloud",
  org: "formbricks",

  // Enable logging to debug sourcemap generation issues
  silent: false,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: false,
};

// Always enable Sentry plugin to inject Debug IDs
// Runtime Sentry reporting still depends on DSN being set via environment variables
const exportConfig = process.env.SENTRY_AUTH_TOKEN ? withSentryConfig(nextConfig, sentryOptions) : nextConfig;


export default exportConfig;
