---
name: sentry-nextjs-sdk
description: Full Sentry SDK setup for Next.js. Use when asked to "add Sentry to Next.js", "install @sentry/nextjs", or configure error monitoring, tracing, session replay, logging, profiling, AI monitoring, or crons for Next.js applications. Supports Next.js 13+ with App Router and Pages Router.
license: Apache-2.0
category: sdk-setup
parent: sentry-sdk-setup
disable-model-invocation: true
---

> [All Skills](../../SKILL_TREE.md) > [SDK Setup](../sentry-sdk-setup/SKILL.md) > Next.js SDK

# Sentry Next.js SDK

Opinionated wizard that scans your Next.js project and guides you through complete Sentry setup across all three runtimes: browser, Node.js server, and Edge.

## Invoke This Skill When

- User asks to "add Sentry to Next.js" or "set up Sentry" in a Next.js app
- User wants to install or configure `@sentry/nextjs`
- User wants error monitoring, tracing, session replay, logging, or profiling for Next.js
- User asks about `instrumentation.ts`, `withSentryConfig()`, or `global-error.tsx`
- User wants to capture server actions, server component errors, or edge runtime errors

> **Note:** SDK versions and APIs below reflect current Sentry docs at time of writing (`@sentry/nextjs` ≥8.28.0).
> Always verify against [docs.sentry.io/platforms/javascript/guides/nextjs/](https://docs.sentry.io/platforms/javascript/guides/nextjs/) before implementing.

---

## Phase 1: Detect

Run these commands to understand the project before making any recommendations:

```bash
# Detect Next.js version and existing Sentry
cat package.json | grep -E '"next"|"@sentry/'

# Detect router type (App Router vs Pages Router)
ls src/app app src/pages pages 2>/dev/null

# Check for existing Sentry config files
ls instrumentation.ts instrumentation-client.ts sentry.server.config.ts sentry.edge.config.ts 2>/dev/null
ls src/instrumentation.ts src/instrumentation-client.ts 2>/dev/null

# Check next.config
ls next.config.ts next.config.js next.config.mjs 2>/dev/null

# Check for existing error boundaries
find . -name "global-error.tsx" -o -name "_error.tsx" 2>/dev/null | grep -v node_modules

# Check build tool
cat package.json | grep -E '"turbopack"|"webpack"'

# Check for logging libraries
cat package.json | grep -E '"pino"|"winston"|"bunyan"'

# Check for companion backend
ls ../backend ../server ../api 2>/dev/null
cat ../go.mod ../requirements.txt ../Gemfile 2>/dev/null | head -3
```

**What to determine:**

| Question | Impact |
|----------|--------|
| Next.js version? | 13+ required; 15+ needed for Turbopack support |
| App Router or Pages Router? | Determines error boundary files needed (`global-error.tsx` vs `_error.tsx`) |
| `@sentry/nextjs` already present? | Skip install, go to feature config |
| Existing `instrumentation.ts`? | Merge Sentry into it rather than replace |
| Turbopack in use? | Tree-shaking in `withSentryConfig` is webpack-only |
| Logging library detected? | Recommend Sentry Logs integration |
| Backend directory found? | Trigger Phase 4 cross-link suggestion |

---

## Phase 2: Recommend

Present a concrete recommendation based on what you found. Don't ask open-ended questions — lead with a proposal:

**Recommended (core coverage):**
- ✅ **Error Monitoring** — always; captures server errors, client errors, server actions, and unhandled promise rejections
- ✅ **Tracing** — server-side request tracing + client-side navigation spans across all runtimes
- ✅ **Session Replay** — recommended for user-facing apps; records sessions around errors

**Optional (enhanced observability):**
- ⚡ **Logging** — structured logs via `Sentry.logger.*`; recommend when `pino`/`winston` or log search is needed
- ⚡ **Profiling** — continuous profiling; requires `Document-Policy: js-profiling` header
- ⚡ **AI Monitoring** — OpenAI, Vercel AI SDK, Anthropic; recommend when AI/LLM calls detected
- ⚡ **Crons** — detect missed/failed scheduled jobs; recommend when cron patterns detected
- ⚡ **Metrics** — custom metrics via `Sentry.metrics.*`; recommend when custom KPIs or business metrics needed

**Recommendation logic:**

| Feature | Recommend when... |
|---------|------------------|
| Error Monitoring | **Always** — non-negotiable baseline |
| Tracing | **Always for Next.js** — server route tracing + client navigation are high-value |
| Session Replay | User-facing app, login flows, or checkout pages |
| Logging | App uses structured logging or needs log-to-trace correlation |
| Profiling | Performance-critical app; client sets `Document-Policy: js-profiling` |
| AI Monitoring | App makes OpenAI, Vercel AI SDK, or Anthropic calls |
| Crons | App has Vercel Cron jobs, scheduled API routes, or `node-cron` usage |
| Metrics | App needs custom counters, gauges, or histograms via `Sentry.metrics.*` |

Propose: *"I recommend setting up Error Monitoring + Tracing + Session Replay. Want me to also add Logging or Profiling?"*

---

## Phase 3: Guide

### Option 1: Wizard (Recommended)

> **You need to run this yourself** — the wizard opens a browser for login and requires interactive input that the agent can't handle. Copy-paste into your terminal:
>
> ```
> npx @sentry/wizard@latest -i nextjs
> ```
>
> It handles login, org/project selection, SDK installation, config files (`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`), `next.config.ts` wrapping, source map upload, and adds a `/sentry-example-page`.
>
> **Once it finishes, come back and skip to [Verification](#verification).**

If the user skips the wizard, proceed with Option 2 (Manual Setup) below.

---

### Option 2: Manual Setup

#### Install

```bash
npm install @sentry/nextjs --save
```

#### Create `instrumentation-client.ts` — Browser / Client Runtime

> Older docs used `sentry.client.config.ts` — the current pattern is `instrumentation-client.ts`.

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "___PUBLIC_DSN___",

  sendDefaultPii: true,

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: 10% of all sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [
    Sentry.replayIntegration(),
    // Optional: user feedback widget
    // Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],
});

// Hook into App Router navigation transitions (App Router only)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

#### Create `sentry.server.config.ts` — Node.js Server Runtime

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "___DSN___",

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,

  enableLogs: true,
});
```

#### Create `sentry.edge.config.ts` — Edge Runtime

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "___DSN___",

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,
});
```

#### Create `instrumentation.ts` — Server-Side Registration Hook

> Requires `experimental.instrumentationHook: true` in `next.config` for Next.js < 14.0.4. It's stable in 14.0.4+.

```typescript
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Automatically captures all unhandled server-side request errors
// Requires @sentry/nextjs >= 8.28.0
export const onRequestError = Sentry.captureRequestError;
```

**Runtime dispatch:**

| `NEXT_RUNTIME` | Config file loaded |
|---|---|
| `"nodejs"` | `sentry.server.config.ts` |
| `"edge"` | `sentry.edge.config.ts` |
| *(client bundle)* | `instrumentation-client.ts` (Next.js handles this directly) |

#### App Router: Create `app/global-error.tsx`

This catches errors in the root layout and React render errors:

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
```

#### Pages Router: Update `pages/_error.tsx`

```tsx
import * as Sentry from "@sentry/nextjs";
import type { NextPageContext } from "next";
import NextErrorComponent from "next/error";

type ErrorProps = { statusCode: number };

export default function CustomError({ statusCode }: ErrorProps) {
  return <NextErrorComponent statusCode={statusCode} />;
}

CustomError.getInitialProps = async (ctx: NextPageContext) => {
  await Sentry.captureUnderscoreErrorException(ctx);
  return NextErrorComponent.getInitialProps(ctx);
};
```

#### Wrap `next.config.ts` with `withSentryConfig()`

```typescript
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // your existing Next.js config
};

export default withSentryConfig(nextConfig, {
  org: "___ORG_SLUG___",
  project: "___PROJECT_SLUG___",

  // Source map upload auth token (see Source Maps section below)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload wider set of client source files for better stack trace resolution
  widenClientFileUpload: true,

  // Create a proxy API route to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,
});
```

#### Exclude Tunnel Route from Middleware

If you have `middleware.ts`, exclude the tunnel path from auth or redirect logic:

```typescript
// middleware.ts
export const config = {
  matcher: [
    // Exclude monitoring route, Next.js internals, and static files
    "/((?!monitoring|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

---

### Source Maps Setup

Source maps make production stack traces readable — without them, you see minified code. This is non-negotiable for production apps.

**Step 1: Generate a Sentry auth token**

Go to [sentry.io/settings/auth-tokens/](https://sentry.io/settings/auth-tokens/) and create a token with `project:releases` and `org:read` scopes.

**Step 2: Set environment variables**

```bash
# .env.sentry-build-plugin  (gitignore this file)
SENTRY_AUTH_TOKEN=sntrys_eyJ...
```

Or set in CI secrets:

```bash
SENTRY_AUTH_TOKEN=sntrys_eyJ...
SENTRY_ORG=my-org        # optional if set in next.config
SENTRY_PROJECT=my-project # optional if set in next.config
```

**Step 3: Add to `.gitignore`**

```
.env.sentry-build-plugin
```

**Step 4: Verify `authToken` is wired in `next.config.ts`**

```typescript
withSentryConfig(nextConfig, {
  org: "my-org",
  project: "my-project",
  authToken: process.env.SENTRY_AUTH_TOKEN, // reads from .env.sentry-build-plugin or CI env
  widenClientFileUpload: true,
});
```

Source maps are uploaded automatically on every `next build`.

---

### For Each Agreed Feature

Load the corresponding reference file and follow its steps:

| Feature | Reference file | Load when... |
|---------|---------------|-------------|
| Error Monitoring | `references/error-monitoring.md` | Always (baseline) — App Router error boundaries, Pages Router `_error.tsx`, server action wrapping |
| Tracing | `references/tracing.md` | Server-side request tracing, client navigation, distributed tracing, `tracePropagationTargets` |
| Session Replay | `references/session-replay.md` | User-facing app; privacy masking, canvas recording, network capture |
| Logging | `references/logging.md` | Structured logs, `Sentry.logger.*`, log-to-trace correlation |
| Profiling | `references/profiling.md` | Continuous profiling, `Document-Policy` header, `nodeProfilingIntegration` |
| AI Monitoring | `references/ai-monitoring.md` | App uses OpenAI, Vercel AI SDK, or Anthropic |
| Crons | `references/crons.md` | Vercel Cron, scheduled API routes, `node-cron` |

For each feature: read the reference file, follow its steps exactly, and verify before moving on.

---

## Verification

After wizard or manual setup, verify Sentry is working:

```typescript
// Add temporarily to a server action or API route, then remove
import * as Sentry from "@sentry/nextjs";

throw new Error("Sentry test error — delete me");
// or
Sentry.captureException(new Error("Sentry test error — delete me"));
```

Then check your [Sentry Issues dashboard](https://sentry.io/issues/) — the error should appear within ~30 seconds.

**Verification checklist:**

| Check | How |
|-------|-----|
| Client errors captured | Throw in a client component, verify in Sentry |
| Server errors captured | Throw in a server action or API route |
| Edge errors captured | Throw in middleware or edge route handler |
| Source maps working | Check stack trace shows readable file names |
| Session Replay working | Check Replays tab in Sentry dashboard |

---

## Config Reference

### `Sentry.init()` Options

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `dsn` | `string` | — | Required. Use `NEXT_PUBLIC_SENTRY_DSN` for client, `SENTRY_DSN` for server |
| `tracesSampleRate` | `number` | — | 0–1; 1.0 in dev, 0.1 in prod recommended |
| `replaysSessionSampleRate` | `number` | `0.1` | Fraction of all sessions recorded |
| `replaysOnErrorSampleRate` | `number` | `1.0` | Fraction of error sessions recorded |
| `sendDefaultPii` | `boolean` | `false` | Include IP, request headers in events |
| `includeLocalVariables` | `boolean` | `false` | Attach local variable values to stack frames (server only) |
| `enableLogs` | `boolean` | `false` | Enable Sentry Logs product |
| `environment` | `string` | auto | `"production"`, `"staging"`, etc. |
| `release` | `string` | auto | Set to commit SHA or version tag |
| `debug` | `boolean` | `false` | Log SDK activity to console |

### `withSentryConfig()` Options

| Option | Type | Notes |
|--------|------|-------|
| `org` | `string` | Sentry organization slug |
| `project` | `string` | Sentry project slug |
| `authToken` | `string` | Source map upload token (`SENTRY_AUTH_TOKEN`) |
| `widenClientFileUpload` | `boolean` | Upload more client files for better stack traces |
| `tunnelRoute` | `string` | API route path for ad-blocker bypass (e.g. `"/monitoring"`) |
| `silent` | `boolean` | Suppress build output (`!process.env.CI` recommended) |
| `webpack.treeshake.*` | `object` | Tree-shake SDK features (webpack only, not Turbopack) |

### Environment Variables

| Variable | Runtime | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Client | DSN for browser Sentry init (public) |
| `SENTRY_DSN` | Server / Edge | DSN for server/edge Sentry init |
| `SENTRY_AUTH_TOKEN` | Build | Source map upload auth token (secret) |
| `SENTRY_ORG` | Build | Org slug (alternative to `org` in config) |
| `SENTRY_PROJECT` | Build | Project slug (alternative to `project` in config) |
| `SENTRY_RELEASE` | Server | Release version string (auto-detected from git) |
| `NEXT_RUNTIME` | Server / Edge | `"nodejs"` or `"edge"` (set by Next.js internally) |

---

## Phase 4: Cross-Link

After completing Next.js setup, check for companion services:

```bash
# Check for backend services in adjacent directories
ls ../backend ../server ../api ../services 2>/dev/null

# Check for backend language indicators
cat ../go.mod 2>/dev/null | head -3
cat ../requirements.txt ../pyproject.toml 2>/dev/null | head -3
cat ../Gemfile 2>/dev/null | head -3
cat ../pom.xml ../build.gradle 2>/dev/null | head -3
```

If a backend is found, suggest the matching SDK skill:

| Backend detected | Suggest skill |
|-----------------|--------------|
| Go (`go.mod`) | `sentry-go-sdk` |
| Python (`requirements.txt`, `pyproject.toml`) | `sentry-python-sdk` |
| Ruby (`Gemfile`) | `sentry-ruby-sdk` |
| Java/Kotlin (`pom.xml`, `build.gradle`) | See [docs.sentry.io/platforms/java/](https://docs.sentry.io/platforms/java/) |
| Node.js (Express, Fastify, Hapi) | `@sentry/node` — see [docs.sentry.io/platforms/javascript/guides/express/](https://docs.sentry.io/platforms/javascript/guides/express/) |

Connecting frontend and backend with the same DSN or linked projects enables **distributed tracing** — stack traces that span your browser, Next.js server, and backend API in a single trace view.

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Events not appearing | DSN misconfigured or `debug: false` hiding errors | Set `debug: true` temporarily; check browser network tab for requests to `sentry.io` |
| Stack traces show minified code | Source maps not uploading | Check `SENTRY_AUTH_TOKEN` is set; run `next build` and look for "Source Maps" in build output |
| `onRequestError` not firing | SDK version < 8.28.0 | Upgrade: `npm install @sentry/nextjs@latest` |
| Edge runtime errors missing | `sentry.edge.config.ts` not loaded | Verify `instrumentation.ts` imports it when `NEXT_RUNTIME === "edge"` |
| Tunnel route returns 404 | `tunnelRoute` set but Next.js route missing | The plugin creates it automatically; check you ran `next build` after adding `tunnelRoute` |
| `withSentryConfig` tree-shaking breaks build | Turbopack in use | Tree-shaking options only work with webpack; remove `webpack.treeshake` options when using Turbopack |
| `global-error.tsx` not catching errors | Missing `"use client"` directive | Add `"use client"` as the very first line of `global-error.tsx` |
| Session Replay not recording | `replayIntegration()` missing from client init | Add `Sentry.replayIntegration()` to `integrations` in `instrumentation-client.ts` |
