import {
  SENTRY_CLIENT_RUNTIME_CONFIG_KEY,
  type TSentryClientRuntimeConfig,
} from "@/app/sentry/client-runtime-config";
import { IS_PRODUCTION, SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_RELEASE } from "@/lib/constants";

/**
 * Serialises the server-only Sentry env vars into the document so `instrumentation-client.ts` can
 * start the browser SDK with runtime values (see `client-runtime-config.ts` for why this hand-off
 * exists). Rendering nothing is the gate: without a DSN or outside production no config -- and no
 * DSN -- reaches the browser, matching the previous `SentryProvider` gating.
 */
export const SentryClientConfigScript = () => {
  if (!IS_PRODUCTION || !SENTRY_DSN) {
    return null;
  }

  const config: TSentryClientRuntimeConfig = {
    dsn: SENTRY_DSN,
    release: SENTRY_RELEASE,
    environment: SENTRY_ENVIRONMENT,
  };

  // `</script>` and friends cannot appear in a DSN, but escaping `<` keeps the inline script safe
  // regardless of what the env vars hold.
  const serializedConfig = JSON.stringify(config).replace(/</g, "\\u003c");

  return (
    <script
      id="sentry-client-config"
      dangerouslySetInnerHTML={{
        __html: `window.${SENTRY_CLIENT_RUNTIME_CONFIG_KEY}=${serializedConfig};`,
      }}
    />
  );
};
