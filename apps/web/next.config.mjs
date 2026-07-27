import { withSentryConfig } from "@sentry/nextjs";
import createJiti from "jiti";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
// Single source of truth for image-optimizer hosts (ENG-1678); shared with the runtime
// `isExternalImageSrc` check in lib/image-hosts.ts so remotePatterns and the per-<Image>
// `unoptimized` decision can never drift apart.
import { LOOPBACK_HOSTS, OPTIMIZABLE_IMAGE_HOSTS } from "./lib/optimizable-image-hosts.mjs";

const jiti = createJiti(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
jiti("./lib/env");

const LOOPBACK_WILDCARD_ORIGINS = LOOPBACK_HOSTS.map((host) => `http://${host}:*`);

const getLoopbackOriginVariants = (value) => {
  if (!value) {
    return [];
  }

  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol) || !LOOPBACK_HOSTS.includes(url.hostname)) {
      return [];
    }

    const portSuffix = url.port ? `:${url.port}` : "";
    const alternateHost = url.hostname === "localhost" ? "127.0.0.1" : "localhost";

    return [
      `${url.protocol}//${url.hostname}${portSuffix}`,
      `${url.protocol}//${alternateHost}${portSuffix}`,
    ];
  } catch {
    return [];
  }
};

const getUniqueValues = (values) => [...new Set(values.filter(Boolean))];

// NOTE: every `process.env.*` read in this file shapes the build output and MUST be listed in the
// root turbo.json `build.env` array so Turborepo hashes it into the cache key. Adding a read here
// without updating turbo.json serves stale cached builds — from the local Turbo cache and the CI
// build-output cache alike. Enforced by lib/turbo-build-env.test.ts. Read env vars directly
// (`process.env.<NAME>` or `process.env["<NAME>"]`), not via destructuring, so that guardrail can
// detect them.
/** @type {import('next').NextConfig} */

const nextConfig = {
  assetPrefix: process.env.ASSET_PREFIX_URL || undefined,
  allowedDevOrigins: process.env.NODE_ENV === "production" ? undefined : LOOPBACK_HOSTS,
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
    "bullmq",
    "ioredis",
    "pino",
    "pino-pretty",
    "pino-opentelemetry-transport",
    "posthog-node",
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
  experimental: {
    proxyClientMaxBodySize: "16mb",
  },
  transpilePackages: ["@formbricks/database"],
  images: {
    // Optimize image processing to reduce CPU time and prevent timeouts
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Removed 3840 to avoid processing huge images
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Standard sizes for smaller images
    formats: ["image/webp"], // WebP is faster to process and smaller than JPEG/PNG
    minimumCacheTTL: 60, // Cache optimized images for at least 60 seconds
    dangerouslyAllowSVG: true, // Allow SVG images
    // Only universal provider/CDN hosts are optimized (ENG-1678). Same-origin `/storage/...` uploads
    // are relative paths (local images, always optimized) and need no entry; the deployment's own
    // domain is intentionally NOT listed since the same build serves every domain. Arbitrary
    // user-provided external URLs are rendered `unoptimized` (see lib/image-hosts.ts) instead of
    // being allowlisted, so the optimizer never acts as an open proxy.
    remotePatterns: OPTIMIZABLE_IMAGE_HOSTS.map((hostname) => ({
      protocol: LOOPBACK_HOSTS.includes(hostname) ? "http" : "https",
      hostname,
    })),
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
      // Redirect old workspace-scoped account settings to the account-scoped routes.
      {
        source: "/workspaces/:workspaceId/settings/account",
        destination: "/account/settings/profile",
        permanent: true,
      },
      {
        source: "/workspaces/:workspaceId/settings/account/:path*",
        destination: "/account/settings/:path*",
        permanent: true,
      },
      // Old workspace-scoped org settings need workspaceId -> organizationId resolution, so they go
      // through a server route shim (not a static redirect). Non-permanent: the target is resolved
      // at request time.
      {
        source: "/workspaces/:workspaceId/settings/organization",
        destination: "/legacy-organization-settings/:workspaceId",
        permanent: false,
      },
      {
        source: "/workspaces/:workspaceId/settings/organization/:path*",
        destination: "/legacy-organization-settings/:workspaceId/:path*",
        permanent: false,
      },
    ];
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const scriptSrcUnsafeEval = isProduction ? "" : " 'unsafe-eval'";
    const allowLoopbackSources = !isProduction || process.env.E2E_TESTING === "1";
    const devLoopbackSources = allowLoopbackSources
      ? getUniqueValues([
          ...LOOPBACK_WILDCARD_ORIGINS,
          ...getLoopbackOriginVariants(process.env.WEBAPP_URL),
          ...getLoopbackOriginVariants(process.env.NEXTAUTH_URL),
          ...getLoopbackOriginVariants(process.env.S3_ENDPOINT_URL),
        ])
      : [];
    const devLoopbackSourceList = devLoopbackSources.length > 0 ? ` ${devLoopbackSources.join(" ")}` : "";

    const cspBase = `default-src 'self'; script-src 'self' 'unsafe-inline'${scriptSrcUnsafeEval} https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' blob: data:${devLoopbackSourceList} https:; font-src 'self' data: https:; connect-src 'self'${devLoopbackSourceList} https: wss:; frame-src 'self' https://app.cal.com https:; media-src 'self' https:; object-src 'self' data: https:; base-uri 'self'; form-action 'self'`;

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
    const posthogRewrites = process.env.POSTHOG_KEY
      ? [
          {
            source: "/ingest/static/:path*",
            destination: "https://eu-assets.i.posthog.com/static/:path*",
          },
          {
            source: "/ingest/:path*",
            destination: "https://eu.i.posthog.com/:path*",
          },
        ]
      : [];
    return [
      ...posthogRewrites,
      {
        source: "/api/v2/organizations/:organizationId/project-teams",
        destination: "/api/v2/organizations/:organizationId/workspace-teams",
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
