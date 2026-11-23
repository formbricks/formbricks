# A Test run executes in the request, against the draft, with fake effects

`POST /workflows/{id}/test-runs` runs the editor's current draft inside the request, with the same graph walk as a real run but with fake effects: Send email records whom it would email, an HTTP request records what it would call and, in "Wait and use it" mode, returns that step's last Test request response (ENG-7170). The result is saved as a run with `isDryRun = true` and no version, so it appears under Runs with a Test label, is never billed (usage counts and cleanup jobs already skip dry runs), and is deleted after 7 days (ADR 0044). The only real outbound call while testing is "Send test request" on one HTTP request, which is not a run.

> Amended by ADR 0054: in "Wait and use it" mode an HTTP request returns the step's expected response body, which editors set. A Test request's answer no longer replaces it; it is kept as `<step id>:last_test` and is only offered to the editor.

## What a Test run runs with

A Webhook workflow runs with a test payload: the one sent, else the workflow's expected payload. A Response completed workflow runs against an existing response of its trigger's survey, picked in the editor and sent as `responseId`. The run's trigger payload is built from that response as a real run builds it (answers, ending), and the run records the response and survey like a real run, so the runs list's survey visibility applies to it. The response must belong to the trigger's survey, in the workflow's workspace, and the caller must be able to read that survey; anything else is refused like an unknown id. A partial response, or one that reached an ending the trigger skips, can still be tested: the editor says a real run would skip it, because the point is to see what the steps do with real answers.

The editor's picker reads the survey's responses through an internal, session-only route keyed by the workflow (`/api/internal/workflows/{id}/test-responses`), not `GET /api/v3/responses`: the survey comes from the workflow, access is the workflow's write access, and each row is a summary rather than a full response.

## Considered Options

- **Queue Test runs like real runs and poll**: uniform with production, but slower feedback and a polling UI, for a run that makes no outside calls.
- **A separate test engine**: no risk of a test sending anything, but two engines that drift.
- **A fabricated response for Response completed workflows**, built from the survey's questions: works before the survey has any response, but tests answers nobody gave, and needs a generator per question type. Testing against a real response, such as one just submitted, shows the run a real one would make.

## Consequences

- The fake-effect switch sits at the effect boundary (email, HTTP); the walker and the conditions run for real, so a Test run shows the branch a real run would take.
- The existing `/test` endpoint stays a setup check that runs nothing.
- A Test run whose request is cut short is never queued to finish it, since a worker would run it with real effects. The cleanup sweep marks one still queued or running more than 10 minutes after it was created as failed, "Test run was interrupted", and does not report it as a workflow failure (ENG-7354).
