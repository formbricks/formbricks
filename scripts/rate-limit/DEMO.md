# Envoy POC Demo Runbook

This runbook is for a live staging demo of the Envoy Gateway rate-limit POC.

## Demo Goal

Show four things:

1. the selected staging routes now traverse the gateway path
2. public client traffic is rate-limited at the gateway
3. API-key-authenticated management traffic is rate-limited at the gateway
4. excluded routes remain unthrottled by the gateway policy set

## Required Inputs

- `ENVIRONMENT_ID`
  - staging environment ID
- `API_KEY`
  - single-environment staging API key

## Demo Script

Use [demo.sh](/Users/bhagya/work/formbricks/formbricks/scripts/rate-limit/demo.sh).

Supported modes:

- `preflight`
- `public`
- `management`
- `negative`
- `evidence`
- `all`

### Full Demo

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID='<environment_id>' \
API_KEY='<api_key>' \
PUBLIC_COUNT=125 \
PUBLIC_CONCURRENCY=20 \
MANAGEMENT_COUNT=200 \
MANAGEMENT_CONCURRENCY=40 \
NEGATIVE_COUNT=25 \
NEGATIVE_CONCURRENCY=10 \
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
MANAGEMENT_COUNT=200 \
MANAGEMENT_CONCURRENCY=40 \
scripts/rate-limit/demo.sh management
```

Excluded-route demo:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
NEGATIVE_COUNT=25 \
NEGATIVE_CONCURRENCY=10 \
scripts/rate-limit/demo.sh negative
```

Recent Envoy log evidence:

```bash
cd /Users/bhagya/work/formbricks/formbricks

LOG_WINDOW=5m \
scripts/rate-limit/demo.sh evidence
```

## Recommended Live Sequence

Use this order:

1. `preflight`
2. `public`
3. `management`
4. `negative`
5. `evidence`

This gives you a complete story:

- the traffic path is on Envoy
- public traffic is blocked at the gateway
- API-key traffic is blocked at the gateway
- excluded routes remain open
- Envoy logs confirm the decisions server-side

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
- the summary prints `gateway_429s=<n>` with `n > 0`

### 3. API-Key Management Route Is Rate-Limited At The Gateway

The management burst step targets:

- `GET /api/v1/management/me`

Success criteria:

- the summary contains `status=429 source=gateway`
- the summary prints `gateway_429s=<n>` with `n > 0`

### 4. Excluded Health Route Is Not Rate-Limited

The excluded-route step targets:

- `GET /api/v2/health`

Success criteria:

- the summary contains no `429` responses
- `gateway_429s=0`
- `app_429s=0`

### 5. Live Envoy Evidence

The evidence step prints matching Envoy log lines for:

- `formbricks-stage-v1-client`
- `formbricks-stage-v1-management`
- `request_rate_limited`

That gives you an infrastructure-side proof in addition to the client-side summary.

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

Show the excluded route probe:

```bash
cd /Users/bhagya/work/formbricks/formbricks

HOST=https://staging.app.formbricks.com \
COUNT=1 \
scripts/rate-limit/burst-test.sh v2-health
```

Show recent Envoy route hits during the demo:

```bash
kubectl logs -n formbricks-stage deploy/formbricks-stage-envoy -c envoy --since=2m | \
rg 'formbricks-stage-v1-client|formbricks-stage-v1-management|request_rate_limited'
```

## Routes To Avoid In The Demo

Do not use the storage upload scenarios in the live demo.

The current dummy payloads intentionally trigger validation `400`s, which makes the demo noisy and does not cleanly demonstrate gateway limiting.
