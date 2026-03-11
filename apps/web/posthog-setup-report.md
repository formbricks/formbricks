## Overview

PostHog analytics has been integrated into the Formbricks web app (`apps/web`) using the Next.js App Router approach with `instrumentation-client.ts`. Autocapture is enabled — all custom events are defined as actions via the PostHog toolbar, not in code.

## Configuration

| Setting | Value |
|---|---|
| PostHog Host | `https://eu.i.posthog.com` |
| Reverse Proxy | `/ingest/*` → `https://eu.i.posthog.com/*` |
| Client Init | `apps/web/instrumentation-client.ts` |
| Server Client | `apps/web/lib/posthog-server.ts` |

## Environment Variables

Added to `apps/web/.env`:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## Packages Installed

- `posthog-js` — client-side tracking
- `posthog-node` — server-side tracking

## Files

### New Files

- **`apps/web/instrumentation-client.ts`** — Client-side PostHog initialization (Next.js 15.3+ App Router pattern)
- **`apps/web/lib/posthog-server.ts`** — Singleton server-side PostHog client
- **`apps/web/app/(app)/components/PostHogIdentify.tsx`** — Client component that identifies users post-auth and handles account switching via `posthog.reset()`

### Modified Files

- **`apps/web/next.config.mjs`** — Added `skipTrailingSlashRedirect: true` and `/ingest/*` reverse proxy rewrites
- **`apps/web/app/(app)/layout.tsx`** — Added `PostHogIdentify` component for post-auth user identification

## User Identification (GDPR-compliant)

- **No PostHog on auth pages** — login/signup pages have zero PostHog calls; no PII is sent before authentication
- **Post-auth identify** — `PostHogIdentify` component in the authenticated layout (`apps/web/app/(app)/layout.tsx`) calls `posthog.identify(userId, { email, name })` after the user is fully authenticated
- **Existing users** — Users who are already logged in (skip signup) are also identified on every authenticated page load
- **Account switching** — When the user ID changes, `posthog.reset()` is called before re-identifying, ensuring distinct users get separate PostHog profiles

## Custom Events

None — all events are tracked via PostHog autocapture and defined as actions through the PostHog toolbar.

## PostHog Dashboards

### 1. Analytics Basics (ID: 563010)

**URL:** https://eu.posthog.com/project/138028/dashboard/563010

| Insight | Type | URL |
|---|---|---|
| User Signups & Logins Over Time | Trends (line) | https://eu.posthog.com/project/138028/insights/vRTZYMqz |
| Signup to First Survey Published Funnel | Funnel | https://eu.posthog.com/project/138028/insights/SXvzJPQz |
| Survey Lifecycle Events | Trends (line) | https://eu.posthog.com/project/138028/insights/8NJpApcm |
| Survey Engagement Actions | Trends (bar) | https://eu.posthog.com/project/138028/insights/cQRrcfBq |
| Full User Journey Funnel | Funnel (unordered) — signup → survey published | https://eu.posthog.com/project/138028/insights/kFjH9atY |
| Total Surveys Published | Trends (bar) — broken down by `survey_type` | https://eu.posthog.com/project/138028/insights/rAPBfnmR |

### 2. Survey Creation & Types (ID: 563022)

**URL:** https://eu.posthog.com/project/138028/dashboard/563022

| Insight | Type | URL |
|---|---|---|
| Link vs In-App Surveys Published | Trends (line) — broken down by `survey_type` | https://eu.posthog.com/project/138028/insights/QL0LkWoI |
| Survey Type Selection Distribution | Trends (pie) | https://eu.posthog.com/project/138028/insights/KPSUe2IF |
| Survey Published to Response Funnel | Funnel (unordered) | https://eu.posthog.com/project/138028/insights/9UPWbBAf |
| Total Surveys Published | Trends (bar) — broken down by `survey_type` | https://eu.posthog.com/project/138028/insights/rAPBfnmR |

### 3. Integrations & API (ID: 563021)

**URL:** https://eu.posthog.com/project/138028/dashboard/563021

| Insight | Type | URL |
|---|---|---|
| Integrations & API Usage | Trends (line) | https://eu.posthog.com/project/138028/insights/ATYgsDY2 |
| Organizations & Responses Over Time | Trends (line) | https://eu.posthog.com/project/138028/insights/DZVTeqql |
| Response Export Format Distribution | Trends (bar value) | https://eu.posthog.com/project/138028/insights/00bQNehy |
