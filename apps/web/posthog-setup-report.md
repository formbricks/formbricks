# PostHog Setup Report

## Overview

PostHog analytics has been integrated into the Formbricks web app (`apps/web`) using the Next.js App Router approach with `instrumentation-client.ts`.

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
NEXT_PUBLIC_POSTHOG_KEY=phc_ies97ZFTIL3f8T1sQOTCWQycBzqqPvkPcOkpxYJ1sOA
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## Packages Installed

- `posthog-js` — client-side tracking
- `posthog-node` — server-side tracking

## Files Modified

### New Files

- **`apps/web/instrumentation-client.ts`** — Client-side PostHog initialization (Next.js 15.3+ App Router pattern)
- **`apps/web/lib/posthog-server.ts`** — Singleton server-side PostHog client

### Modified Files

- **`apps/web/next.config.mjs`** — Added `skipTrailingSlashRedirect: true` and `/ingest/*` reverse proxy rewrites
- **`apps/web/modules/auth/signup/components/signup-form.tsx`** — Added `user_signed_up` event + `posthog.identify()`
- **`apps/web/modules/auth/login/components/login-form.tsx`** — Added `user_logged_in` event + `posthog.identify()`
- **`apps/web/modules/survey/editor/components/survey-menu-bar.tsx`** — Added `survey_saved` and `survey_published` events
- **`apps/web/modules/survey/list/components/survey-dropdown-menu.tsx`** — Added `survey_deleted`, `survey_duplicated`, and `survey_link_copied` events
- **`apps/web/modules/survey/components/template-list/index.tsx`** — Added `link_survey_created` / `in_app_survey_created` events
- **`apps/web/modules/survey/editor/components/how-to-send-card.tsx`** — Added `survey_type_selected` event
- **`apps/web/modules/organization/settings/api-keys/components/edit-api-keys.tsx`** — Added `api_key_created` event
- **`apps/web/modules/organization/components/CreateOrganizationModal/index.tsx`** — Added `organization_created` event
- **`apps/web/modules/setup/organization/create/components/create-organization.tsx`** — Added `organization_created` event (setup flow)
- **`apps/web/modules/integrations/webhooks/components/add-webhook-modal.tsx`** — Added `webhook_created` event
- **`apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter.tsx`** — Added `responses_exported` event
- **`apps/web/app/api/v2/client/[environmentId]/responses/route.ts`** — Added server-side `survey_response_finished` event

## Events Tracked

| Event | Location | Properties |
|---|---|---|
| `user_signed_up` | `signup-form.tsx` | `name`, `email`, `is_formbricks_cloud`, `has_invite_token`, `email_verification_disabled` |
| `user_logged_in` | `login-form.tsx` | `email`, `method` |
| `link_survey_created` | `template-list/index.tsx` | `survey_id`, `template_name`, `environment_id` |
| `in_app_survey_created` | `template-list/index.tsx` | `survey_id`, `template_name`, `environment_id` |
| `survey_type_selected` | `how-to-send-card.tsx` | `survey_id`, `survey_type`, `previous_type` |
| `survey_saved` | `survey-menu-bar.tsx` | `survey_id`, `survey_name`, `survey_type`, `survey_status` |
| `survey_published` | `survey-menu-bar.tsx` | `survey_id`, `survey_name`, `survey_type` |
| `survey_deleted` | `survey-dropdown-menu.tsx` | `survey_id`, `survey_name`, `survey_type`, `survey_status` |
| `survey_duplicated` | `survey-dropdown-menu.tsx` | `original_survey_id`, `new_survey_id`, `survey_name`, `survey_type`, `environment_id` |
| `survey_link_copied` | `survey-dropdown-menu.tsx` | `survey_id`, `survey_name`, `survey_type` |
| `survey_response_finished` | `responses/route.ts` (server) | `survey_id`, `response_id`, `environment_id` |
| `organization_created` | `CreateOrganizationModal`, `create-organization.tsx` | `organization_id`, `organization_name` |
| `api_key_created` | `edit-api-keys.tsx` | `organization_id`, `api_key_label` |
| `webhook_created` | `add-webhook-modal.tsx` | `environment_id`, `webhook_triggers`, `survey_count` |
| `responses_exported` | `CustomFilter.tsx` | `survey_id`, `survey_name`, `file_type`, `filter_type` |

## PostHog Dashboards

### 1. Analytics Basics (ID: 563010)

**URL:** https://eu.posthog.com/project/138028/dashboard/563010

| Insight | Type | URL |
|---|---|---|
| User Signups & Logins Over Time | Trends (line) | https://eu.posthog.com/project/138028/insights/vRTZYMqz |
| Signup to First Survey Published Funnel | Funnel | https://eu.posthog.com/project/138028/insights/SXvzJPQz |
| Survey Lifecycle Events | Trends (line) — includes `link_survey_created` + `in_app_survey_created` | https://eu.posthog.com/project/138028/insights/8NJpApcm |
| Survey Engagement Actions | Trends (bar) | https://eu.posthog.com/project/138028/insights/cQRrcfBq |
| Full User Journey Funnel | Funnel (unordered) — includes both survey creation events | https://eu.posthog.com/project/138028/insights/kFjH9atY |
| Total Surveys Created | Trends (bar) — combines `link_survey_created` + `in_app_survey_created` | https://eu.posthog.com/project/138028/insights/rAPBfnmR |

### 2. Survey Creation & Types (ID: 563022)

**URL:** https://eu.posthog.com/project/138028/dashboard/563022

| Insight | Type | URL |
|---|---|---|
| Link vs In-App Survey Creation | Trends (line) | https://eu.posthog.com/project/138028/insights/QL0LkWoI |
| Survey Type Selection Distribution | Trends (pie) | https://eu.posthog.com/project/138028/insights/KPSUe2IF |
| Survey Creation to Response Funnel | Funnel (unordered) — includes both `link_survey_created` + `in_app_survey_created` | https://eu.posthog.com/project/138028/insights/9UPWbBAf |
| Total Surveys Created | Trends (bar) — combines both events | https://eu.posthog.com/project/138028/insights/rAPBfnmR |

### 3. Integrations & API (ID: 563021)

**URL:** https://eu.posthog.com/project/138028/dashboard/563021

| Insight | Type | URL |
|---|---|---|
| Integrations & API Usage | Trends (line) | https://eu.posthog.com/project/138028/insights/ATYgsDY2 |
| Organizations & Responses Over Time | Trends (line) | https://eu.posthog.com/project/138028/insights/DZVTeqql |
| Response Export Format Distribution | Trends (bar value) | https://eu.posthog.com/project/138028/insights/00bQNehy |
