# Envoy Rate-Limit Validation

This directory holds the staging validation tooling for the Envoy rate-limit POC:

- [burst-test.sh](/Users/bhagya/work/formbricks/formbricks-1519/scripts/rate-limit/burst-test.sh) and
  [demo.sh](/Users/bhagya/work/formbricks/formbricks-1519/scripts/rate-limit/demo.sh) are the operator-facing
  smoke/demo scripts.
- [run-k6.sh](/Users/bhagya/work/formbricks/formbricks-1519/scripts/rate-limit/run-k6.sh) and
  [k6/envoy-hardening.js](/Users/bhagya/work/formbricks/formbricks-1519/scripts/rate-limit/k6/envoy-hardening.js)
  are the repeatable hardening suite for `internal#1519`.

Use the shell scripts for live demos and quick one-off checks. Use the `k6` suite for smoke, burst, and soak
validation.

## k6 suite

The `k6` suite covers the three first-class hardening scenarios:

- `public`
  - `GET /api/v1/client/{environmentId}/environment`
- `management`
  - `GET /api/v1/management/me` with `x-api-key`
- `negative`
  - `GET /api/v2/health`

Profiles:

- `smoke`
  - 1-5 requests to confirm the request path is Envoy-backed (`source=gateway`)
- `burst`
  - enough concurrency to force gateway `429`s on the covered routes
- `soak`
  - longer sustained load to surface `500/503`, probe flaps, or cache instability

The wrapper prefers a local `k6` binary and falls back to Docker automatically.

### Required environment variables

- `HOST`
  - defaults to `https://staging.app.formbricks.com`
- `ENVIRONMENT_ID`
  - required for `public`
- `API_KEY`
  - required for `management`

### Optional environment variables

- `VUS`
  - override the profile default concurrent virtual users
- `ITERATIONS`
  - override the `per-vu-iterations` count used by `smoke` and `burst`
- `DURATION`
  - override the soak duration
- `MAX_DURATION`
  - override the `smoke`/`burst` max duration
- `SLEEP_SECONDS`
  - add a delay between iterations
- `K6_DOCKER_IMAGE`
  - override the default Docker fallback image (`grafana/k6:latest`)

### Example

```bash
HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID=<environment_id> \
API_KEY=<api_key> \
scripts/rate-limit/run-k6.sh smoke all
```

```bash
HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID=<environment_id> \
scripts/rate-limit/run-k6.sh burst public
```

```bash
HOST=https://staging.app.formbricks.com \
API_KEY=<api_key> \
VUS=20 \
ITERATIONS=6 \
scripts/rate-limit/run-k6.sh burst management
```

### What the `k6` summary reports

Each run ends with a machine-readable summary block:

- total requests
- `200`, `429`, `5xx`, and `other` counts
- `gateway_routed_responses`
- `gateway_429s`, `app_429s`, `unknown_429s`
- p95/p99 latency
- `result=PASS|FAIL`

Pass criteria:

- `public` / `management` `smoke`
  - at least one gateway-tagged response
  - no `429`s
  - no `5xx`s
  - no `status_other` responses
- `public` / `management` `burst`
  - at least one gateway `429`
  - zero app `429`s
  - zero `5xx`s
  - zero `status_other` responses
- `public` / `management` `soak`
  - gateway path confirmed
  - at least one gateway `429`
  - zero app `429`s
  - zero `5xx`s
  - zero `status_other` responses
- `negative`
  - zero `429`s, zero `5xx`s, and zero `status_other` responses

## Shell scripts

The shell scripts keep their existing role as quick operator tools:

- `burst-test.sh`
  - request-by-request output for ad hoc checks or live debugging
- `demo.sh`
  - guided staging demo flow used in meetings

## How the shell scripts classify responses

`source=gateway` means the response included Envoy-visible headers such as `x-envoy-ratelimited` or
`x-ratelimit-*`, or the POC returned an empty-body `429`.

`source=app` means the response body matched the Formbricks `too_many_requests` JSON shape.

`source=unknown` means the response was neither of those and should be inspected manually.
