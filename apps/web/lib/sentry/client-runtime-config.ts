/**
 * Runtime hand-off for the browser Sentry config.
 *
 * `SENTRY_DSN` and friends are server-only env vars (no `NEXT_PUBLIC_` prefix) so that self-hosted
 * Docker images can be configured at container start instead of at build time. Client bundles are
 * built once, so the values cannot be inlined -- the root layout serialises them into the HTML and
 * `instrumentation-client.ts` picks them up from this global.
 *
 * Kept free of `@sentry/nextjs` imports so the server component that writes the global does not pull
 * the browser SDK into its module graph.
 */

export interface TSentryClientRuntimeConfig {
  dsn: string;
  release?: string;
  environment?: string;
}

/** Name of the `window` property carrying the config. Must match the `Window` augmentation below. */
export const SENTRY_CLIENT_RUNTIME_CONFIG_KEY = "__formbricksSentryClientConfig";

declare global {
  interface Window {
    __formbricksSentryClientConfig?: TSentryClientRuntimeConfig;
  }
}
