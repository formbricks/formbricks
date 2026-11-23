# Workflow conditions reuse survey logic's operators and comparison

A workflow's If/else compares values with the same function as survey logic and uses the survey operator names (`doesNotEqual`, `isGreaterThan`, `includesOneOf`, …) (ENG-7165). The function moves into `packages/types` and is called by `packages/surveys/src/lib/logic.ts`, `apps/web/lib/surveyLogic/utils.ts` and the workflow runner, so a number sent as `"412"` or a multi-select answer behaves the same in a survey and in a workflow, and the If/else panel can use the kit `ConditionsEditor` survey logic already uses. The workflow schema shipped in v1 with its own ten operator names; nothing could execute them yet, but API v3 and MCP accepted them, so those names stay accepted under ADR 0050.

## Considered Options

- **Keep the workflow operators and their own comparison**: no rename, but a third copy of comparison rules that would drift from survey logic, and an editor that can't reuse `ConditionsEditor`.

## Consequences

- A change to how survey logic compares values changes workflows too; both are tested against the one function.
- Only operators that make sense without a survey element are offered in workflows.
