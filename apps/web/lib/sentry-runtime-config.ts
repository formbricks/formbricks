// Shared between app/layout.tsx (which serializes the current runtime values into an inline
// script) and instrumentation-client.ts (which reads them back off `window`). Kept side-effect
// free and NOT guarded by "server-only" so both a server and a client file can import the type.
export interface SentryRuntimeConfig {
  dsn?: string;
  environment?: string;
}
