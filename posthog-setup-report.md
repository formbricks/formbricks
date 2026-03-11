# PostHog Integration Setup Report

## Overview

PostHog has been integrated into the Formbricks web app (`apps/web/`) for product analytics, user identification, and error tracking.

- **PostHog Project ID:** 138028
- **PostHog Host:** https://eu.i.posthog.com (EU region)
- **Dashboard:** [Analytics basics](https://eu.posthog.com/project/138028/dashboard/560936)

---

## Configuration

### Environment Variables

Set in root `.env`:

```
NEXT_PUBLIC_POSTHOG_TOKEN=phc_ies97ZFTIL3f8T1sQOTCWQycBzqqPvkPcOkpxYJ1sOA
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

### Packages Installed

```
apps/web: posthog-js@1.360.0, posthog-node@5.28.0
```

---

## New Files

| File | Purpose |
|------|---------|
| `apps/web/instrumentation-client.ts` | Client-side PostHog initialization (Next.js 15.3+ pattern) |
| `apps/web/lib/posthog-server.ts` | Server-side PostHog singleton for API routes and Server Actions |

### `apps/web/instrumentation-client.ts`

Client-side init with reverse proxy, exception capture, and EU region:

```typescript
import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_TOKEN!, {
  api_host: "/ingest",
  ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
});
```

### `apps/web/lib/posthog-server.ts`

Singleton for server-side use (`flushAt: 1, flushInterval: 0` for short-lived serverless functions):

```typescript
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
```

---

## Modified Files

### `apps/web/next.config.mjs`

Added PostHog reverse proxy rewrites (EU region) and `skipTrailingSlashRedirect`:

```javascript
// Added to rewrites():
{ source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
{ source: "/ingest/:path*",        destination: "https://eu.i.posthog.com/:path*" },

// Added to nextConfig:
skipTrailingSlashRedirect: true,
```

---

## Tracked Events

### Auth & Onboarding

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `user_signed_up` | `modules/auth/signup/components/signup-form.tsx` | User completes signup form | Client |
| `user_logged_in` | `modules/auth/login/components/login-form.tsx` | User logs in with email | Client |
| `organization_created` | `modules/setup/organization/create/components/create-organization.tsx` | New org created during onboarding | Client |
| `workspace_created` | `modules/projects/components/create-project-modal/index.tsx` | New project/workspace created | Client |

### Survey Lifecycle

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `survey_type_selected` | `modules/survey/editor/components/how-to-send-card.tsx` | User selects link or in-app survey type | Client |
| `survey_saved` | `modules/survey/editor/components/survey-menu-bar.tsx` | Survey saved (non-draft) | Client |
| `survey_published` | `modules/survey/editor/components/survey-menu-bar.tsx` | Survey published (draft → inProgress) | Client |
| `survey_deleted` | `modules/survey/list/components/survey-dropdown-menu.tsx` | Survey deleted from list | Client |
| `survey_duplicated` | `modules/survey/list/components/survey-dropdown-menu.tsx` | Survey duplicated | Client |
| `survey_link_copied` | `modules/analysis/components/ShareSurveyLink/index.tsx` | User copies the survey share link | Client |

### Survey Responses (Server-side — captures both link & in-app surveys)

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `survey_displayed` | `app/api/v1/client/[environmentId]/displays/route.ts` | Survey impression created (in-app or link) | Server |
| `survey_response_created` | `app/api/v1/client/[environmentId]/responses/route.ts` | New response submitted (any survey type) | Server |
| `survey_response_finished` | `app/api/v1/client/.../responses/route.ts` & `.../responses/[responseId]/route.ts` | Response marked as finished (initial or update) | Server |

### Formbricks JS (Website / App SDK)

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `formbricks_js_connected` | `app/api/v1/client/.../environment/lib/environmentState.ts` | First time the Formbricks JS SDK loads and fetches environment state (sets `appSetupCompleted`) | Server |

### Billing

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `upgrade_plan_clicked` | `modules/ee/billing/components/pricing-table.tsx` | Upgrade button clicked on billing page | Client |
| `subscription_upgraded` | `modules/ee/billing/api/lib/checkout-session-completed.ts` | Stripe checkout session completed | Server |
| `subscription_cancelled` | `modules/ee/billing/api/lib/subscription-deleted.ts` | Stripe subscription deleted webhook | Server |

### Integrations & Webhooks

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `integration_connected` | `app/(app)/.../workspace/integrations/actions.ts` | Integration created/updated (Slack, Google Sheets, Notion, Airtable) | Server |
| `webhook_created` | `modules/integrations/webhooks/components/add-webhook-modal.tsx` | Webhook successfully created | Client |

### Contacts & Segments

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `contacts_imported` | `modules/ee/contacts/components/upload-contacts-button.tsx` | Contacts imported via CSV upload | Client |
| `segment_created` | `modules/ee/contacts/segments/components/create-segment-modal.tsx` | New segment created | Client |

### Data Export

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `responses_exported` | `app/(app)/.../surveys/[surveyId]/components/CustomFilter.tsx` | Responses downloaded as CSV or XLSX | Client |

### Team & API

| Event | File | Trigger | Side |
|-------|------|---------|------|
| `member_invited` | `modules/organization/settings/teams/components/invite-member/individual-invite-tab.tsx` | Team member invited | Client |
| `api_key_created` | `modules/organization/settings/api-keys/components/add-api-key-modal.tsx` | API key created | Client |

---

### Event Properties Reference

| Event | Key Properties |
|-------|---------------|
| `survey_type_selected` | `surveyId`, `surveyType` (link/app) |
| `survey_link_copied` | `surveyId`, `surveyName`, `surveyType`, `singleUse` |
| `survey_displayed` | `surveyId`, `environmentId`, `hasUserId` |
| `survey_response_created` | `surveyId`, `surveyName`, `surveyType`, `environmentId`, `responseId`, `finished` |
| `survey_response_finished` | `surveyId`, `surveyName`, `surveyType`, `environmentId`, `responseId` |
| `formbricks_js_connected` | `environmentId`, `projectId` |
| `integration_connected` | `integrationType`, `environmentId`, `organizationId` |
| `webhook_created` | `environmentId`, `triggers`, `surveyCount` |
| `responses_exported` | `surveyId`, `surveyName`, `format` (csv/xlsx), `filterType` (all/filtered) |
| `segment_created` | `environmentId`, `filterCount` |
| `contacts_imported` | `environmentId`, `contactCount`, `duplicateAction` |
| `api_key_created` | `permissionCount` |

---

### User Identification

`posthog.identify()` is called on signup and login with `email` as the `distinctId`:

```typescript
posthog.identify(data.email, { email: data.email, name: data.name });
```

### Exception Capture

`posthog.captureException(error)` is called in catch blocks across:
- Login form
- Organization creation
- Survey save/publish
- Survey delete/duplicate

---

## Recommended Dashboard Insights

### 1. Survey Response Volume (Daily)
- **Type:** Trend
- **Events:** `survey_response_created` broken down by `surveyType` (link vs app)
- **Purpose:** Track total response volume and compare link vs in-app surveys

### 2. Survey Completion Funnel
- **Type:** Funnel
- **Steps:** `survey_displayed` → `survey_response_created` → `survey_response_finished`
- **Purpose:** Measure drop-off between impressions and completions

### 3. Full User Journey Funnel
- **Type:** Funnel
- **Steps:** `user_signed_up` → `survey_published` → `survey_response_finished`
- **Purpose:** Track activation from signup to first completed response

### 4. Integration Adoption
- **Type:** Trend (bar)
- **Events:** `integration_connected` broken down by `integrationType`
- **Purpose:** Track which integrations are most popular

### 5. Feature Adoption Overview
- **Type:** Trend (table)
- **Events:** `webhook_created`, `segment_created`, `contacts_imported`, `api_key_created`, `responses_exported`
- **Purpose:** Track power-user feature adoption

### 6. Survey Distribution Methods
- **Type:** Trend (pie)
- **Events:** `survey_type_selected` broken down by `surveyType`
- **Purpose:** Understand link vs in-app survey preference

---

## Notes

- The reverse proxy (`/ingest`) routes PostHog requests through the Next.js server, avoiding ad-blocker issues and keeping first-party data collection.
- Server-side billing events (Stripe webhooks) use `organizationId` as `distinctId` since there is no active user session in webhook handlers.
- Server-side response/display events use `environmentId` as `distinctId` to group activity by environment.
- The existing `instrumentation.ts` (Sentry/OpenTelemetry) was not modified — `instrumentation-client.ts` is a separate client-only file.
- Server-side events for responses (`survey_response_created`, `survey_response_finished`, `survey_displayed`) capture ALL survey types (link surveys, in-app surveys, and API-created responses) in a single pipeline.
