# The expected payload is set by editors, never by calls

A workflow with a Webhook trigger has an **expected payload**: the JSON object its calling system sends to the Secret URL. The Variables the steps use are inferred from it, and a Test run sends it. Only editors set it, in the editor or through `PUT /api/v3/workflows/{id}/sample` (and the `set_sample_payload` MCP tool): typed, pasted, or a received call they chose to use. A call to the Secret URL never changes it. The last call is kept on its own `WorkflowSample` row (source `trigger_last_call`, with its time and IP), and `GET /webhook` returns it as `lastCall` next to the expected payload, so the editor can show "A call arrived… Use as expected payload" and, when a newer call has different fields, "Review / Use it instead / Keep the current one". Enabling a Webhook workflow requires an expected payload (422 `workflow_not_executable`, `trigger.expectedPayload`).

This reverses the Part 2 design where every call replaced the stored payload (spec §1, §3; the old route described it as "the payload also becomes the workflow's Sample payload"). Runs never depended on that payload, since each run uses the payload of its own call. But everything built from the stored one did: the Variables list and @ picker, the payload Test run sends, and the editor's view of which fields exist. One odd, buggy or hostile call to the URL could change all of them under the author, and anyone holding the URL could do it on purpose.

## Considered Options

- **Keep "the last call replaces it"**: zero setup when the system already calls the URL, which is why it was chosen first. Rejected: the author loses control of the shape their steps are built on, without noticing.
- **Let only the first call fill it, then freeze it**: still lets whoever calls first decide the shape, and a first test call with partial data becomes the contract.
- **Write by hand only, with no way to use a call**: safest, but calling systems with large payloads are tedious to transcribe. Using a call stays one explicit click after reviewing its fields.
- **Validate incoming calls against it**: calls that do not match would be refused or flagged. Not adopted for Part 2: payloads legitimately vary (optional fields), and a refused call loses data the sender may not resend. The name is "expected payload", not "schema", for that reason.

## Consequences

- The API keeps its Part 2 names (`sample`, `PUT /sample`, `set_sample_payload`): they are not renamed, only described as the expected payload (ADR 0050). `lastCall` is an additive field.
- The expected payload is the trigger's configuration, not call data: the retention sweep (ADR 0044) no longer deletes it. Last calls and HTTP request Test request responses still expire after the retention period.
- Workflows created before this change keep whatever their stored payload was as their expected payload. Their last call shows up again on the next call.
- During a rolling upgrade an old pod still writes calls to the `trigger` row, so a call can change the expected payload until the upgrade finishes. Part 2 had not shipped, so this window has no users.
