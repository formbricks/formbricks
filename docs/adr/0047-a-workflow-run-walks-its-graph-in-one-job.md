# A workflow run walks its graph in one job; branches never join

A run is one background job that walks the workflow from its trigger along its connections: an If/else picks its Then or Else connection, and each step's output is kept under the step's id for later steps (ENG-7165). This replaces the v1 straight-line plan. Steps on a branch run one after another because a later step may use any earlier output; only independent loads (version, survey, response, secrets) run in parallel. HTTP retries happen inside the step, and an HTTP request set to "Don't wait" hands its call to a separate job, so the run moves on. Branches never join again and nothing fans out, which keeps "which Variables exist at this step" a question with one answer.

## Considered Options

- **Pausable runs** (park the run, re-enqueue at the next step): needed later for Delay and for retries that don't hold a worker, but too much for Part 2.
- **Fan-out and joining branches**: closer to general workflow engines, but needs canvas layout work, a rule for Variables from branches that did not run, and concurrency in one run.

## Consequences

- A slow HTTP target holds a shared background worker for up to about 50 seconds per step (10 s timeout, 3 retries with backoff).
- Each step still runs at most once per run, as in v1; after a crash, later steps rebuild earlier outputs from the stored run log, which keeps at most 64 KB of an HTTP response.
- During a rolling upgrade an old worker fails runs that use Part 2 steps and drops the unknown "Don't wait" job; a "Don't wait" step still sending after an hour is marked failed.
