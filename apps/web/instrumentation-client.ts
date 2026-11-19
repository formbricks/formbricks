// Next.js client instrumentation hook: runs in the browser before any app code and before
// hydration, so module-evaluation, hydration and early-navigation errors are captured. Replaces the
// former `SentryProvider` `useEffect`, which only started Sentry after hydration (ENG-1686).
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { initClientSentryFromRuntimeConfig } from "@/lib/sentry/init-client-sentry";

// Before any app code builds a schema: Zod 4 probes `new Function("")` when the first object schema is
// constructed, and our CSP has no 'unsafe-eval' in production, so the browser blocks the probe and
// reports a violation on every page (ENG-3969). Without the JIT Zod skips the probe. Browser only —
// this file never runs on the server.
z.config({ jitless: true });

initClientSentryFromRuntimeConfig();

// eslint-disable-next-line import/namespace -- exported by @sentry/nextjs's client build, which this browser entry resolves; the rule reads the server one
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
