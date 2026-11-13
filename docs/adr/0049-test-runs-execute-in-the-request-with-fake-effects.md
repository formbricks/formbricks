# A Test run executes in the request, against the draft, with fake effects

`POST /workflows/{id}/test-runs` runs the editor's current draft inside the request, with the same graph walk as a real run but with fake effects: Send email records whom it would email, an HTTP request records what it would call and, in "Wait and use it" mode, returns that step's last Test request response (ENG-7170). The result is saved as a run with `isDryRun = true` and no version, so it appears under Runs with a Test label, is never billed (usage counts and cleanup jobs already skip dry runs), and is deleted after 7 days (ADR 0044). The only real outbound call while testing is "Send test request" on one HTTP request, which is not a run.

## Considered Options

- **Queue Test runs like real runs and poll**: uniform with production, but slower feedback and a polling UI, for a run that makes no outside calls.
- **A separate test engine**: no risk of a test sending anything, but two engines that drift.

## Consequences

- The fake-effect switch sits at the effect boundary (email, HTTP); the walker and the conditions run for real, so a Test run shows the branch a real run would take.
- The existing `/test` endpoint stays a setup check that runs nothing.
