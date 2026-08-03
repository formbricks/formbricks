// Next.js client instrumentation hook: runs in the browser before any app code and before
// hydration, so module-evaluation, hydration and early-navigation errors are captured. Replaces the
// former `SentryProvider` `useEffect`, which only started Sentry after hydration (ENG-1686).
import * as Sentry from "@sentry/nextjs";
import { initClientSentryFromRuntimeConfig } from "@/app/sentry/init-client-sentry";

initClientSentryFromRuntimeConfig();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
