# Envoy POC Demo Runbook

This runbook is for a live staging demo of the Envoy Gateway rate-limit POC.

## Demo Goal

Show three things:

1. the selected staging routes now traverse the gateway path
2. public client traffic is rate-limited at the gateway
3. API-key-authenticated management traffic is rate-limited at the gateway

## Required Inputs

- `ENVIRONMENT_ID`
  - staging environment ID
- `API_KEY`
  - single-environment staging API key

## Demo Script

Use [demo.sh](/Users/bhagya/work/formbricks/formbricks/scripts/rate-limit/demo.sh).

### Full Demo

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID='<environment_id>' \
API_KEY='<api_key>' \
scripts/rate-limit/demo.sh all
```

### Step-by-Step

Preflight:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID='<environment_id>' \
API_KEY='<api_key>' \
scripts/rate-limit/demo.sh preflight
```

Public route demo:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID='<environment_id>' \
PUBLIC_COUNT=125 \
PUBLIC_CONCURRENCY=20 \
scripts/rate-limit/demo.sh public
```

Management API-key demo:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
API_KEY='<api_key>' \
MANAGEMENT_COUNT=125 \
MANAGEMENT_CONCURRENCY=20 \
scripts/rate-limit/demo.sh management
```

## What To Say During The Demo

### 1. Gateway Path Is Active

The preflight step should report:

- `status=200 source=gateway` for `v1-client-environment`
- `status=200 source=gateway` for `management-api-key`

That proves the response is coming through the Envoy path rather than directly from the old app ingress path.

### 2. Public Client Route Is Rate-Limited At The Gateway

The public burst step targets:

- `GET /api/v1/client/<environment_id>/environment`

Success criteria:

- the summary contains `status=429 source=gateway`

### 3. API-Key Management Route Is Rate-Limited At The Gateway

The management burst step targets:

- `GET /api/v1/management/me`

Success criteria:

- the summary contains `status=429 source=gateway`

## Expected Caveat

Staging can still show intermittent `500` or `503` responses under high burst load on the environment route.

For the demo, this does **not** invalidate the POC if:

- the preflight shows `source=gateway`
- the burst summary shows `status=429 source=gateway`

That means the gateway path and rate-limiting policy are working, and the remaining issue is staging stability on the upstream route under burst load.

## Useful Supporting Commands

Show one direct public probe:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID='<environment_id>' \
COUNT=1 \
scripts/rate-limit/burst-test.sh v1-client-environment
```

Show one direct management probe:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
API_KEY='<api_key>' \
COUNT=1 \
scripts/rate-limit/burst-test.sh management-api-key
```

Show recent Envoy route hits during the demo:

```bash
kubectl logs -n formbricks-stage deploy/formbricks-stage-envoy -c envoy --since=2m | \
rg 'formbricks-stage-v1-client|formbricks-stage-v1-management|request_rate_limited'
```

## Routes To Avoid In The Demo

Do not use the storage upload scenarios in the live demo.

The current dummy payloads intentionally trigger validation `400`s, which makes the demo noisy and does not cleanly demonstrate gateway limiting.
