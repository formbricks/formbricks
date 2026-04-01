# Envoy Rate-Limit Coverage Matrix

This document is the staging coverage source of truth for `formbricks/internal#1519`.

It answers two separate questions:

- which request prefixes currently traverse Envoy on staging
- which current application limiter call sites are already covered, coverable later, or intentionally left in
  the app

## Current Envoy-routed prefixes

The staging ALB forwards only these prefixes to Envoy:

- `/api/auth/callback`
- `/api/v1/client`
- `/api/v2/client`
- `/api/v1/management`
- `/api/v1/webhooks`
- `/storage`

Everything else still goes directly to the chart-managed Formbricks Service.

## Current Envoy rate-limited route groups

These route groups already have active Envoy rate-limit policies on staging:

- `POST /api/auth/callback/credentials`
  - coarse `40 / hour` gateway approximation for the stricter app `10 / 15 minutes` login limit
- `POST /api/auth/callback/token`
  - `10 / hour`
- `GET|POST|PUT /api/v1/client/{environmentId}/(environment|responses|responses/{responseId}|displays|user)`
  - `100 / minute`
- `POST /api/v1/client/{environmentId}/storage`
  - `5 / minute`
- `POST|PUT /api/v2/client/{environmentId}/responses(?:/{responseId})`
  - `100 / minute`
- `POST /api/v2/client/{environmentId}/displays`
  - `100 / minute`
- `POST /api/v2/client/{environmentId}/storage`
  - `5 / minute`
- `GET|POST|PUT|DELETE /api/v1/management/*` when `x-api-key` is present
  - `100 / minute`
- `POST /api/v1/management/storage` when `x-api-key` is present
  - `5 / minute`
- `GET|POST|PUT|DELETE /api/v1/webhooks/*` when `x-api-key` is present
  - `100 / minute`
- `DELETE /storage/{environmentId}/{public|private}/{fileName}` when `x-api-key` is present
  - `5 / minute`

## Call-site coverage matrix

This matrix covers every current `applyIPRateLimit` / `applyRateLimit` call site on `main`.

| Limiter config | Caller / route family | Key type | Stable gateway path | Status | Reason |
| --- | --- | --- | --- | --- | --- |
| `rateLimitConfigs.auth.login` | `modules/auth/lib/authOptions.ts` credentials callback | IP | `POST /api/auth/callback/credentials` | `covered_now` | Stable public callback path. Envoy uses a coarse `40 / hour` approximation while the stricter app limit remains active. |
| `rateLimitConfigs.auth.verifyEmail` | `modules/auth/lib/authOptions.ts` token callback | IP | `POST /api/auth/callback/token` | `covered_now` | Stable public callback path and identical `10 / hour` limit at the gateway. |
| `rateLimitConfigs.auth.signup` | `modules/auth/signup/actions.ts` | IP | None | `not_coverable_now` | Server action flow, not a stable gateway-managed HTTP route. |
| `rateLimitConfigs.auth.forgotPassword` | `modules/auth/forgot-password/actions.ts` | IP | None | `not_coverable_now` | Server action flow, not a stable gateway-managed HTTP route. |
| `rateLimitConfigs.auth.verifyEmail` | `modules/auth/verification-requested/actions.ts` resend verification flow | IP | None | `not_coverable_now` | Same config as the covered token callback, but this caller is a server action instead of a stable public API path. |
| `rateLimitConfigs.api.client` | `app/lib/api/with-api-logging.ts` public V1 client routes | IP | `/api/v1/client/{environmentId}/(environment|responses|responses/{responseId}|displays|user)` | `covered_now` | Public V1 client paths already match the Envoy policy set. |
| `rateLimitConfigs.storage.upload` | `app/api/v1/client/[environmentId]/storage/route.ts` via `with-api-logging.ts` | IP | `POST /api/v1/client/{environmentId}/storage` | `covered_now` | Custom storage upload limit is already broken out as its own Envoy rule. |
| `rateLimitConfigs.api.v1` | `app/lib/api/with-api-logging.ts` API-key-authenticated V1 management routes | API key | `/api/v1/management/*` except storage | `covered_now` | Stable `x-api-key` surface already routed through Envoy. |
| `rateLimitConfigs.storage.upload` | `app/api/v1/management/storage/route.ts` API-key branch via `with-api-logging.ts` | API key | `POST /api/v1/management/storage` | `covered_now` | Custom storage upload limit already has its own Envoy rule. |
| `rateLimitConfigs.api.v1` | `app/lib/api/with-api-logging.ts` API-key-authenticated webhooks | API key | `/api/v1/webhooks/*` | `covered_now` | Stable `x-api-key` webhook surface already routed through Envoy. |
| `rateLimitConfigs.api.v1` | `app/lib/api/with-api-logging.ts` session-authenticated integration routes | Session user ID | None | `not_coverable_now` | Session identity is only resolved inside the app, not at the gateway. |
| `rateLimitConfigs.api.v1` | `app/lib/api/with-api-logging.ts` session-authenticated V1 management routes | Session user ID | None | `not_coverable_now` | The current Envoy rules only cover the API-key branch of the V1 management surface. |
| `rateLimitConfigs.api.v1` | `app/api/v1/management/me/route.ts` API-key branch | API key | `GET /api/v1/management/me` | `covered_now` | Direct handler, but the path is already behind Envoy and matched by the V1 management policy. |
| `rateLimitConfigs.api.v1` | `app/api/v1/management/me/route.ts` session branch | Session user ID | None | `not_coverable_now` | Same path, but this branch keys on session user ID instead of an edge-visible identifier. |
| `rateLimitConfigs.api.v2` | `modules/api/v2/auth/api-wrapper.ts` authenticated V2 API surface | API key | `/api/v2/*` outside `/api/v2/client` | `coverable_later` | Stable API-key paths exist, but the current Envoy POC only routes the public `/api/v2/client` surface. |
| `rateLimitConfigs.api.v3` or custom V3 configs | `app/api/v3/lib/api-wrapper.ts` | Session user ID or API key | Route-specific, mainly `/api/v3/*` | `coverable_later` | The wrapper supports mixed auth modes. Production hardening needs a deliberate V3 route inventory before moving any of it to Envoy. |
| `rateLimitConfigs.storage.delete` | `app/storage/[environmentId]/[accessType]/[fileName]/route.ts` API-key branch | API key | `DELETE /storage/{environmentId}/{public|private}/{fileName}` | `covered_now` | Envoy already enforces the API-key branch on the stable storage delete path. |
| `rateLimitConfigs.storage.delete` | `app/storage/[environmentId]/[accessType]/[fileName]/route.ts` user branch | User ID | None | `not_coverable_now` | The user-authenticated delete branch depends on app-side identity. |
| `rateLimitConfigs.actions.sendLinkSurveyEmail` | `modules/survey/link/actions.ts` | IP | None | `not_coverable_now` | Server action flow with no stable public API contract. |
| `rateLimitConfigs.actions.emailUpdate` | `app/(app)/environments/[environmentId]/settings/(account)/profile/actions.ts` | User ID | None | `not_coverable_now` | User-scoped server action, not an edge-visible identifier. |
| `rateLimitConfigs.actions.surveyFollowUp` | `modules/survey/follow-ups/lib/follow-ups.ts` | Organization ID | None | `not_coverable_now` | Organization-scoped internal workflow, not a stable public API route. |
| `rateLimitConfigs.actions.licenseRecheck` | `modules/ee/license-check/actions.ts` | User ID | None | `not_coverable_now` | Internal server action with user-scoped identity resolved inside the app. |

## Envoy-covered paths without a matching current app limiter call site

These routes are already covered by Envoy even though `main` does not currently have a dedicated
`applyIPRateLimit` / `applyRateLimit` call site for them:

- `POST|PUT /api/v2/client/{environmentId}/responses(?:/{responseId})`
- `POST /api/v2/client/{environmentId}/displays`
- `POST /api/v2/client/{environmentId}/storage`

They stay in scope for the hardening load tests because they are part of the active gateway policy set.

## Explicit exclusions

- `/api/v1/client/og`
  - routed through the `/api/v1/client` prefix, but intentionally excluded from Envoy rate limiting
- `/api/v2/health`
  - not routed through Envoy and explicitly used as the negative control
- `OPTIONS`
  - excluded from the current Envoy rate-limit match set

## How to interpret failures

- Gateway `429`
  - look for `x-envoy-ratelimited` or `x-ratelimit-*`
  - body does not use the Formbricks `code: "too_many_requests"` JSON shape
- App `429`
  - V1 responses use `apps/web/app/lib/api/response.ts`
  - V2 responses use `apps/web/modules/api/v2/lib/response.ts`
  - V3 responses use `apps/web/app/api/v3/lib/response.ts`
