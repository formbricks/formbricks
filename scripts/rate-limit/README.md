# Rate-Limit Burst Checks

These scripts are for validating the Envoy Gateway staging POC without changing runtime behavior in the app.

## What the script reports

For each request it prints:

- request number
- scenario name
- HTTP status
- response source guess

`source=gateway` means the response included `x-envoy-ratelimited`.

For the staging Envoy POC, the script also treats the standard `x-ratelimit-*` headers and empty-body `429`
responses as gateway hits, because those are the headers currently visible on the live gateway path.

`source=app` means the response body matched the Formbricks `too_many_requests` JSON shape.

`source=unknown` means the response was neither of those and should be inspected manually.

## Required environment variables

- `HOST`
  - defaults to `https://staging.app.formbricks.com`
- `ENVIRONMENT_ID`
  - required for client API scenarios
- `API_KEY`
  - required for management, webhooks, and storage-delete scenarios

## Optional environment variables

- `COUNT`
  - number of requests to send
- `CONCURRENCY`
  - number of in-flight requests to run in parallel
- `SLEEP_SECONDS`
  - delay between requests
- `RESPONSE_ID`
  - used by the `v2-responses-put` scenario
- `WEBHOOK_ID`
  - used by the `webhooks-api-key` scenario
- `FILE_KEY`
  - used by the `storage-delete-api-key` scenario

## Example

```bash
HOST=https://staging.app.formbricks.com \
ENVIRONMENT_ID=<environment_id> \
COUNT=110 \
CONCURRENCY=20 \
scripts/rate-limit/burst-test.sh v1-client-environment
```
