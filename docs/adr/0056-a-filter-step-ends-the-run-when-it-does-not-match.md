# A Filter step ends the run when its conditions don't match

A workflow has a Filter step: the If/else's condition group, operators and limits, with one way out. When the conditions hold, the run goes on to the next step; when they don't, the run ends there as completed (not failed), and the steps after it show as "Not taken" in run detail and fade on the canvas. The walker gets a third decision for it, `end`, next to `continue` and `branch`, so a run that a Filter ended is told apart from one stopped by a failed step (`stop`). Its log output is `{ passed, conditions }`; it offers later steps no Variables, since they only run when it passed.

To filter until now, an author added an If/else and left Else empty. That works, but people have to translate "only continue for gold customers" into "branch, and fill only one side", and the canvas shows a fork with a dead end. Reviewers of Workflows Part 2 asked for the Filter that other workflow tools (Attio, Zapier) offer for exactly this.

## Considered Options

- **Keep If/else with an empty Else**: no new step type, but the intent stays hidden and run detail reads "Else" for a run that was simply filtered out.
- **An If/else display mode**: one schema, but the canvas, the API and agents would have to special-case an If/else whose Else must stay empty.
- **End a filtered-out run as `canceled`**: tells it apart in the Runs list, but nothing went wrong and the run did what it was built to do; completed with "Didn't match: the run ended here" in run detail is accurate.

## Consequences

- `filter` is a new node type in the definition schema, API v3 (`WorkflowFilterNode`, `WorkflowRunFilterDetail`) and MCP; additive. Its conditions follow every If/else rule: one operator name set per definition (ADR 0050), choice ids (ADR 0055), the shared comparison (ADR 0046).
- A run with an older worker that doesn't know the step fails it, as for any new step type during a rolling upgrade.
