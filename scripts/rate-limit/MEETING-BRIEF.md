# Envoy Rate-Limit POC Meeting Brief

This brief is for the meeting about the current Envoy rate-limiting POC, what it does today, what is still missing, and what the next development steps should be before production rollout.

## Objective

Align on:

1. what the current staging POC actually proves
2. what is still unstable or incomplete
3. what the productionization path should be
4. which next engineering steps to prioritize

## Current Scope

The current POC is:

- Kubernetes-native
- Envoy Gateway based
- running on EKS staging
- enforcing rate limits in parallel with existing app-side Redis rate limits

It is **not** yet a production-ready rollout.

## Current Architecture

For the selected staging routes, the path is now:

- Cloudflare
- staging ALB
- Envoy Gateway
- Formbricks staging web service

The old catch-all app ingress still serves the rest of the app directly. Only selected API prefixes are routed through Envoy for this POC.

## Current Envoy-Covered Route Set

There are two different scopes to keep separate:

1. routes that currently traverse Envoy on staging
2. routes that currently have an active Envoy rate-limit policy

### Routes Currently Routed Through Envoy

These prefixes are currently sent to Envoy first on staging:

- `/api/auth/callback`
- `/api/v1/client`
- `/api/v2/client`
- `/api/v1/management`
- `/api/v1/webhooks`
- `/storage`

The ALB health check path `/health` is also wired through Envoy so the staging Envoy service can be health-checked cleanly.

### Routes Currently Rate-Limited By Envoy

The active `BackendTrafficPolicy` resources currently cover these route groups:

- auth callbacks by client IP:
  - `POST /api/auth/callback/credentials`
    - `40 / hour` at the gateway
    - this is an approximation of the stricter app-side `10 / 15 min` limit, because Envoy Gateway global rate limits only support whole-unit windows
  - `POST /api/auth/callback/token`
    - `10 / hour`
- V1 client routes by client IP:
  - `POST /api/v1/client/{environmentId}/storage`
    - `5 / min`
  - `GET|POST|PUT|PATCH|DELETE /api/v1/client/{environmentId}/environment`
    - `100 / min`
  - `GET|POST|PUT|PATCH|DELETE /api/v1/client/{environmentId}/responses`
    - `100 / min`
  - `GET|POST|PUT|PATCH|DELETE /api/v1/client/{environmentId}/responses/{responseId}`
    - `100 / min`
  - `GET|POST|PUT|PATCH|DELETE /api/v1/client/{environmentId}/displays`
    - `100 / min`
  - `GET|POST|PUT|PATCH|DELETE /api/v1/client/{environmentId}/user`
    - `100 / min`
- V2 client routes by client IP:
  - `POST|PUT /api/v2/client/{environmentId}/responses`
    - `100 / min`
  - `POST|PUT /api/v2/client/{environmentId}/responses/{responseId}`
    - `100 / min`
  - `POST /api/v2/client/{environmentId}/displays`
    - `100 / min`
  - `POST /api/v2/client/{environmentId}/storage`
    - `5 / min`
- V1 management routes by `x-api-key`:
  - `POST /api/v1/management/storage`
    - `5 / min`
  - `GET|POST|PUT|PATCH|DELETE /api/v1/management/*`
    - `100 / min`
- V1 webhooks routes by `x-api-key`:
  - `GET|POST|PUT|PATCH|DELETE /api/v1/webhooks/*`
    - `100 / min`
- storage delete by `x-api-key`:
  - `DELETE /storage/{environmentId}/{public|private}/...`
    - `5 / min`

### Explicitly Not Covered By Envoy Rate Limiting

Important examples that are **not** currently rate-limited by Envoy:

- `/api/v2/health`
  - not routed through Envoy in the current POC
  - this is the negative-control route used in the demo
- `/api/v1/client/og`
  - routed under the broader `/api/v1/client` prefix, but not matched by the active V1 client rate-limit regex
- routes outside the listed prefixes above
  - still go straight through the old staging app ingress

## Relevant PRs

- Formbricks app support PR: [formbricks#7583](https://github.com/formbricks/formbricks/pull/7583)
- Infra POC PR: [infra#145](https://github.com/formbricks/infra/pull/145)
- GitOps staging ingress-order PR: [gitops#70](https://github.com/formbricks/gitops/pull/70)

## What Works Today

### 1. Gateway Pathing Is Working

We validated that staging requests for the selected routes now traverse Envoy.

Evidence:

- the burst tooling reports `source=gateway`
- Envoy access logs show real routed traffic for:
  - `formbricks-stage-v1-client`
  - `formbricks-stage-v1-management`

### 2. Gateway Rate Limiting Is Working

We validated gateway `429`s on staging for:

- public client route:
  - `GET /api/v1/client/[environmentId]/environment`
- API-key route:
  - `GET /api/v1/management/me`

Evidence:

- demo/burst output shows `status=429 source=gateway`
- Envoy logs show:
  - `response_code: 429`
  - `response_code_details: request_rate_limited`
  - `response_flags: RL`

### 3. Shared ALB Routing Issue Was Fixed

The initial POC looked broken because traffic was still bypassing Envoy. The cause was shared-ALB ingress ordering.

The fix was:

- Envoy ingress priority higher
- old catch-all staging ingress priority lower

That fix is now represented in:

- [envoy-gateway.tf](/Users/bhagya/work/formbricks/infra/platform/core-eks/envoy-gateway.tf)
- [values-stage.yaml](/Users/bhagya/work/formbricks/gitops/formbricks/values-stage.yaml)

## What Is Not Clean Yet

### 1. Intermittent Burst Instability Still Exists

Under high-concurrency bursts, the environment route can still produce intermittent non-rate-limit failures.

Observed behavior:

- external staging path:
  - expected gateway `429`s
  - intermittent `503`s
- direct in-cluster through Envoy:
  - `98 x 200`
  - `40 x 429`
  - `2 x 500`
- direct in-cluster to the app service, bypassing Envoy:
  - `99 x 200`
  - `41 x 429`
  - `0 x 503`

Interpretation:

- the rate-limiting path is working
- there is also an upstream app instability on the environment route under burst
- the external `503`s are a secondary symptom on top of that upstream instability

### 2. Environment Route Is the Main Hotspot

The problematic route is:

- [route.ts](/Users/bhagya/work/formbricks/formbricks/apps/web/app/api/v1/client/[environmentId]/environment/route.ts)

It depends on:

- [environmentState.ts](/Users/bhagya/work/formbricks/formbricks/apps/web/app/api/v1/client/[environmentId]/environment/lib/environmentState.ts)
- [data.ts](/Users/bhagya/work/formbricks/formbricks/apps/web/app/api/v1/client/[environmentId]/environment/lib/data.ts)
- [service.ts](/Users/bhagya/work/formbricks/formbricks/packages/cache/src/service.ts)

### 3. Redis/Cache Errors Are Visible During the Burst Window

During the same period, the staging app logs show repeated Redis cache failures for:

- `fb:env:<environmentId>:state`

Examples seen:

- `Cache get operation failed`
- `Cache set operation failed`

This strongly suggests the route stability problem is entangled with the cache path on the environment-state endpoint.

### 4. Staging Has Only One App Replica

The staging Formbricks deployment is still a single replica.

Implication:

- if that pod stalls or responds slowly under burst load, there is no buffer
- liveness/readiness probe failures immediately translate into a noisy external path

## Demo Status

The demo is ready.

Use:

- [DEMO.md](/Users/bhagya/work/formbricks/formbricks/scripts/rate-limit/DEMO.md)
- [demo.sh](/Users/bhagya/work/formbricks/formbricks/scripts/rate-limit/demo.sh)

Recommended demo focus:

1. prove gateway pathing with one-request probes
2. prove public-route gateway `429`s
3. prove API-key-route gateway `429`s

Do not use storage upload scenarios in the demo right now. The current dummy payloads produce validation `400`s and make the demonstration noisy.

## Suggested Meeting Narrative

### What the POC proves

- We can run Kubernetes-native gateway rate limiting in front of Formbricks on staging.
- We can enforce both IP-keyed and API-key-keyed limits at the gateway.
- We can do this without removing the existing app-side Redis rate limits.

### What the POC does not yet prove

- that the current selected upstream routes are stable enough under burst for production
- that the same setup is production-ready operationally
- that the GKE/KSA side is solved

## Production Gaps

Before production rollout, the main gaps are:

### 1. Fix the environment route instability

Priority: highest

Why:

- this is the route most likely to be called at scale
- it already shows intermittent app `500`s under burst
- those propagate into external `503`s

### 2. Improve upstream resilience

At minimum:

- increase staging replica count for realistic soak testing
- verify HPA behavior
- verify probe behavior under burst load

### 3. Harden observability

Need clearer signals for:

- gateway `429`s
- upstream `500`s
- external `503`s
- Redis/cache failures on hot environment-state keys

### 4. Merge and stabilize the routing source of truth

The ALB ordering fix depends on the GitOps ingress-order change being merged and synced.

### 5. Decide production rollout shape

Open choices:

- keep app-side Redis rate limits in parallel initially
- or later remove overlap for routes fully covered by the gateway

For now, parallel mode is the safer production introduction.

## Recommended Next Engineering Steps

### Short Term

1. Merge the GitOps ingress-order fix so staging routing does not drift.
2. Investigate and fix intermittent `500`s on the environment endpoint.
3. Increase staging app replicas to reduce single-pod fragility during validation.
4. Re-run burst and soak tests after the route fix.

### Medium Term

1. Define the initial production route set.
2. Add production-grade monitoring and alerting around Envoy and upstream route health.
3. Run a controlled rollout in production with app-side Redis limits still active in parallel.

### Later

1. Extend the same pattern to GKE/KSA if desired.
2. Revisit whether app-side overlap should be removed for gateway-managed routes.

## Decisions To Drive In The Meeting

These are the concrete decisions worth getting:

1. Is the current staging POC accepted as proof of concept, despite the known upstream instability?
2. Should we prioritize fixing the environment route before any production discussion?
3. Should staging be moved to 2 replicas before further validation?
4. Should the first production rollout keep app Redis limits active in parallel?
5. Which route set should be included in phase 1 production rollout?
6. Is GKE/KSA explicitly phase 2, or should it be planned in parallel?

## Command Summary

Full demo:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID='<environment_id>' \
API_KEY='<api_key>' \
./scripts/rate-limit/demo.sh all
```

Show recent gateway evidence:

```bash
kubectl logs -n formbricks-stage deploy/formbricks-stage-envoy -c envoy --since=2m | \
rg 'formbricks-stage-v1-client|formbricks-stage-v1-management|request_rate_limited'
```

Show upstream app errors:

```bash
kubectl logs -n formbricks-stage deploy/formbricks -c formbricks --since=10m | \
rg 'Cache get operation failed|Cache set operation failed|Error in GET /api/v1/client/\\[environmentId\\]/environment|V1 API Error Details'
```

## Bottom Line

The Envoy POC is successful as a staging proof of gateway-based rate limiting.

The next step is **not** to redesign the gateway path again. The next step is to harden the upstream environment route and staging resilience so the validated gateway path can be taken seriously as a production candidate.
