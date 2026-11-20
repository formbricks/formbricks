# An HTTP request's response fields are set by editors, never by test requests

An HTTP request step in "Wait and use it" mode has an **expected response body**: the JSON body its API answers with. Its fields are the Variables later steps pick (`steps.<id>.body.*`), and a Test run's "Wait and use it" answers with it. Only someone with write access sets it on purpose: in the step's Expected response body card (typed, pasted, or a Test request response they chose to use), or through `PUT /api/v3/workflows/{id}/steps/{stepId}/expected-response` and the `set_expected_response` MCP tool. A Test request never changes it. Its answer is kept on its own `WorkflowSample` row (source `<step id>:last_test`), and the card offers it: "Use as expected response body" while none is set, or "Review / Use it instead / Keep the current one" when a newer answer has different fields. This is ADR 0052's rule for the Webhook trigger's expected payload, applied to HTTP request responses.

Until now every Test request's answer replaced the step's sample, which was the only source of those Variables. So nobody could build the later steps of a workflow until the API was reachable and answered, an answer from a test account (missing optional fields, an error body) silently became the shape the later steps were built on, and a Test run answered with whatever the last test returned.

## Considered Options

- **Keep "the last Test request replaces it"**: no setup when the API is already reachable. Rejected for the reasons above, and because it differs from the Webhook trigger, where editors already own the shape.
- **Let a Test request fill it only while it is empty**: still lets the first test answer decide the shape without the author choosing it; offering it as one click keeps the convenience.
- **Write by hand only**: safest, but long API answers are tedious to transcribe. Using a test answer stays one explicit click after seeing its fields.

## Consequences

- The step's sample keeps its source (the step id) and its shape (`{status, contentType, body}`; an editor-written one is status 200, JSON), so the Variable picker, Test request contexts and Test runs read it unchanged. Steps saved before this change keep their last Test request response as their expected response body.
- The expected response body is configuration, so the retention sweep (ADR 0044) keeps it; last Test request responses and last Webhook calls expire.
- A step without an expected response body has only `steps.<id>.status` as a Variable, and a Test run's "Wait and use it" answers with none (flagged `testSample: missing`), as before.
- Editors, API v3 clients (`PUT /api/v3/workflows/{id}/steps/{stepId}/expected-response`) and MCP agents (`set_expected_response`) set it through the same operation; a Test request, from any of them, never does. Enabling doesn't need one.
