# API Regression Testing Plan (Environment -> Workspace Migration)

## Goal

Validate that API key authorization and returned data stay behaviorally identical after moving from environment-centric access to workspace-centric access.

This plan is based on current route/auth logic in:
- `apps/web/app/api/v1/**`
- `apps/web/modules/api/v2/**`
- `apps/web/app/api/v3/**`
- `apps/web/modules/ee/contacts/api/**`

## API Keys Under Test

| Key Alias | Actual Key | Intended Scope |
|---|---|---|
| `K1_W1_DEV_MANAGE` | `fbk_k65Cpf1ZHJTJjKyhixQ7OzWHTTTUIC5u2UQun1PMhcg` | Workspace 1 / Dev / `manage` |
| `K2_W1_PROD_READ` | `fbk_f829m6TovrkojaPC40WBFJ7DVBVPs7iz0T0yWf9i_zo` | Workspace 1 / Prod / `read` |
| `K3_W2_DEV_MANAGE` | `fbk_0_bfuUpv6p9mbZe3o5EWnMnziw3gBUnrdMK0YG0aAKs` | Workspace 2 / Dev / `manage` |
| `K4_W2_PROD_WRITE` | `fbk_-6ozHplGDklxK6qTivfYEbv_gRSsWx_ZPonc4eaGcYo` | Workspace 2 / Prod / `write` |

## Permission Model To Regress

Environment permission mapping from `hasPermission(...)`:
- `GET` -> requires `read` (or higher)
- `POST` / `PUT` / `PATCH` -> requires `write` (or `manage`)
- `DELETE` -> requires `manage`

Expected by key:
- `K1` and `K3` (`manage`): allowed for all methods in their own environment.
- `K4` (`write`): allowed for `GET/POST/PUT/PATCH` in own environment; denied `DELETE`.
- `K2` (`read`): allowed for `GET` in own environment only; denied write/delete methods.

## Test Data Setup (Required Before Execution)

Create stable fixtures per environment/workspace so every endpoint can be validated deterministically:

- Workspace 1 Dev (`W1_DEV_ENV_ID`)
- Workspace 1 Prod (`W1_PROD_ENV_ID`)
- Workspace 2 Dev (`W2_DEV_ENV_ID`)
- Workspace 2 Prod (`W2_PROD_ENV_ID`)

For **each** environment, seed at least:
- 1 survey (`link` type), with one completed and one unfinished response
- 1 webhook tied to that survey
- 1 action class
- 1 contact + contact attributes + custom contact attribute key (if EE contacts enabled)
- 1 segment containing that contact (for contact-link endpoints)
- 1 storage-upload-capable target (for signed URL endpoint)

Also keep fixture IDs for every resource so both positive and negative access tests can reference exact resources.

---

## Expected Data Visibility Rules (Applies Everywhere)

1. **Collection endpoints** must return only resources belonging to environments listed in the API key permissions.
2. **Resource-by-id endpoints** must:
   - return success only when resource environment matches key scope and method permission,
   - otherwise return authorization failure (`401`/`403` depending on endpoint family).
3. **Cross-workspace leakage is never allowed**: no key should ever read/modify resource in another workspace/env.
4. **v3 workspace endpoints** must map workspace -> environment consistently; authorization outcome should match legacy env permission semantics.

---

## Endpoint Matrix: v1

### Auth and Profile

| Endpoint | Method | Scope Source | Expected By Key |
|---|---|---|---|
| `/api/v1/auth` | `GET` | API key itself | All 4 keys: `200`; returns API key + linked env permissions |
| `/api/v1/management/me` | `GET` | API key itself | `200` only if key has exactly one env permission (these 4 should); payload must match that env/project |

### Surveys

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v1/management/surveys` | `GET` | all key envs | 200, only W1 Dev surveys | 200, only W1 Prod surveys | 200, only W2 Dev surveys | 200, only W2 Prod surveys |
| `/api/v1/management/surveys` | `POST` | `body.environmentId` | 200 on W1 Dev, deny others | 401 | 200 on W2 Dev, deny others | 200 on W2 Prod, deny others |
| `/api/v1/management/surveys/{surveyId}` | `GET` | survey env | allow own env | allow own env | allow own env | allow own env |
| `/api/v1/management/surveys/{surveyId}` | `PUT` | survey env | allow own env | 401 | allow own env | allow own env |
| `/api/v1/management/surveys/{surveyId}` | `DELETE` | survey env | allow own env | 401 | allow own env | 401 |
| `/api/v1/management/surveys/{surveyId}/singleUseIds` | `GET` | survey env | allow own env link survey | allow own env link survey | allow own env link survey | allow own env link survey |

### Responses

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v1/management/responses` | `GET` | query `surveyId` env, or all key envs | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v1/management/responses` | `POST` | `body.environmentId` + survey env match | allow own env | 401 | allow own env | allow own env |
| `/api/v1/management/responses/{responseId}` | `GET` | response->survey env | allow own env | allow own env | allow own env | allow own env |
| `/api/v1/management/responses/{responseId}` | `PUT` | response->survey env | allow own env | 401 | allow own env | allow own env |
| `/api/v1/management/responses/{responseId}` | `DELETE` | response->survey env | allow own env | 401 | allow own env | 401 |

### Action Classes

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v1/management/action-classes` | `GET` | all key envs | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v1/management/action-classes` | `POST` | `body.environmentId` | allow own env | 401 | allow own env | allow own env |
| `/api/v1/management/action-classes/{id}` | `GET` | actionClass env | allow own env | allow own env | allow own env | allow own env |
| `/api/v1/management/action-classes/{id}` | `PUT` | actionClass env | allow own env | 401 | allow own env | allow own env |
| `/api/v1/management/action-classes/{id}` | `DELETE` | actionClass env | allow own env | 401 | allow own env | 401 |

### Webhooks

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v1/webhooks` | `GET` | all key envs | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v1/webhooks` | `POST` | `body.environmentId` | allow own env | 401 | allow own env | allow own env |
| `/api/v1/webhooks/{id}` | `GET` | webhook env | allow own env | allow own env | allow own env | allow own env |
| `/api/v1/webhooks/{id}` | `DELETE` | webhook env | allow own env | 401 | allow own env | 401 |

### Storage Signed Upload

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v1/management/storage` | `POST` | `body.environmentId` | allow own env | 401 | allow own env | allow own env |

### EE Contacts (if enabled)

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v1/management/contacts` | `GET` | all key envs | 200 scoped (or 403 if EE off) | same | same | same |
| `/api/v1/management/contacts/{id}` | `GET` | contact env | allow own env | allow own env | allow own env | allow own env |
| `/api/v1/management/contacts/{id}` | `DELETE` | contact env | allow own env | 401 | allow own env | 401 |
| `/api/v1/management/contact-attributes` | `GET` | all key envs | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v1/management/contact-attribute-keys` | `GET` | all key envs | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v1/management/contact-attribute-keys` | `POST` | `body.environmentId` | allow own env | 401 | allow own env | allow own env |
| `/api/v1/management/contact-attribute-keys/{id}` | `GET` | key env | allow own env | allow own env | allow own env | allow own env |
| `/api/v1/management/contact-attribute-keys/{id}` | `PUT` | key env | allow own env | 401 | allow own env | allow own env |
| `/api/v1/management/contact-attribute-keys/{id}` | `DELETE` | key env | allow own env | 401 | allow own env | 401 |

---

## Endpoint Matrix: v2

### Global / Org-Level

| Endpoint | Method | Expected |
|---|---|---|
| `/api/v2/health` | `GET` | 200 if healthy (no API key required) |
| `/api/v2/roles` | `GET` | All 4 keys should get 200 with same role list |
| `/api/v2/me` | `GET` | 200 only when key has organization access (`read`/`write`), otherwise 401 |

> Note: v2 org endpoints (`/api/v2/organizations/{organizationId}/teams`, `/project-teams`, `/users`) require `organizationAccess` and matching organizationId param. If your four keys only have env permissions, expected result is unauthorized for all methods.

### Responses

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v2/management/responses` | `GET` | all key envs (plus query filters) | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v2/management/responses` | `POST` | survey -> env | allow own env (201) | 401 | allow own env (201) | allow own env (201) |
| `/api/v2/management/responses/{id}` | `GET` | response -> env | allow own env | allow own env | allow own env | allow own env |
| `/api/v2/management/responses/{id}` | `PUT` | response -> env | allow own env | 401 | allow own env | allow own env |
| `/api/v2/management/responses/{id}` | `DELETE` | response -> env | allow own env | 401 | allow own env | 401 |

### Webhooks

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v2/management/webhooks` | `GET` | all key envs | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v2/management/webhooks` | `POST` | `body.environmentId` | allow own env (201) | 403 | allow own env (201) | allow own env (201) |
| `/api/v2/management/webhooks/{id}` | `GET` | webhook env | allow own env | allow own env | allow own env | allow own env |
| `/api/v2/management/webhooks/{id}` | `PUT` | webhook env | allow own env | 401 | allow own env | allow own env |
| `/api/v2/management/webhooks/{id}` | `DELETE` | webhook env | allow own env | 401 | allow own env | 401 |

### Contact Attribute Keys

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v2/management/contact-attribute-keys` | `GET` | query env or all key envs | 200 scoped | 200 scoped | 200 scoped | 200 scoped |
| `/api/v2/management/contact-attribute-keys` | `POST` | `body.environmentId` | allow own env (201) | 403 | allow own env (201) | allow own env (201) |
| `/api/v2/management/contact-attribute-keys/{id}` | `GET` | key env | allow own env | allow own env | allow own env | allow own env |
| `/api/v2/management/contact-attribute-keys/{id}` | `PUT` | key env | allow own env | 401 | allow own env | allow own env |
| `/api/v2/management/contact-attribute-keys/{id}` | `DELETE` | key env | allow own env | 401 | allow own env | 401 |

### Survey Contact Links (EE Contacts + link surveys)

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v2/management/surveys/{surveyId}/contact-links/contacts/{contactId}` | `GET` | survey -> env | allow own env | allow own env | allow own env | allow own env |
| `/api/v2/management/surveys/{surveyId}/contact-links/segments/{segmentId}` | `GET` | survey -> env | allow own env | allow own env | allow own env | allow own env |

### EE Contacts (if enabled)

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v2/management/contacts` | `POST` | `body.environmentId` | allow own env (201) | 403 | allow own env (201) | allow own env (201) |
| `/api/v2/management/contacts/bulk` | `PUT` | `body.environmentId` | allow own env (200/207) | 403 | allow own env (200/207) | allow own env (200/207) |

---

## Endpoint Matrix: v3

| Endpoint | Method | Scope Source | `K1` | `K2` | `K3` | `K4` |
|---|---|---|---|---|---|---|
| `/api/v3/surveys?workspaceId={ws}` | `GET` | workspaceId -> environment via resolver | 200 for W1 Dev workspace; 403 for others | 200 for W1 Prod workspace; 403 for others | 200 for W2 Dev workspace; 403 for others | 200 for W2 Prod workspace; 403 for others |

Regression-critical checks for v3:
- No workspace can be accessed via key from another workspace.
- Returned survey list/count/cursor must match legacy env-scoped survey visibility.
- Response always includes `X-Request-Id`.

---

## Concrete Regression Test Cases (Execute For Every Endpoint Family)

For each endpoint/method:

1. **Positive Same-Scope**
   - Use key with sufficient permission against its own env/workspace resource.
   - Assert success status and payload shape.
2. **Negative Cross-Workspace**
   - Use same key against a resource in another workspace.
   - Assert auth failure and no data leakage.
3. **Negative Insufficient Method Permission**
   - `K2` (`read`) on write endpoints -> deny.
   - `K4` (`write`) on delete endpoints -> deny.
4. **Collection Leakage Test**
   - Call list endpoint with each key.
   - Assert every returned row belongs only to that key’s allowed env(s).
5. **ID Enumeration Safety**
   - Try valid IDs from unauthorized envs.
   - Assert deny response, no foreign resource details.

---

## Suggested Execution Order

1. v1 auth/me
2. v1 survey/response/action-class/webhook/storage
3. v1 EE contacts
4. v2 global + management
5. v2 org endpoints (if organizationAccess is configured on these keys)
6. v3 surveys by workspace

Run each step for all 4 keys before proceeding.

---

## Pass Criteria

Migration is regression-safe when all are true:

- Authorization decisions are unchanged (same allow/deny per key/method/resource scope).
- Returned datasets are unchanged in scope (no missing own-scope data, no foreign-scope leakage).
- Error classes/statuses remain consistent per API family (v1/v2/v3).
- v3 workspace mapping yields equivalent visibility to legacy environment mapping.

---

## Optional Automation Harness (Recommended)

Implement an automated matrix runner (Postman/Newman or Playwright API tests) with:

- Inputs: `baseUrl`, 4 API keys, fixture IDs by env/workspace
- For each test: endpoint, method, key alias, expected status, expected env/workspace ownership assertions
- Final report grouped by endpoint family and key alias

This makes repeated migration verification deterministic and CI-friendly.
