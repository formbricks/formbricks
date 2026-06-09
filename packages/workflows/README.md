# Formbricks Workflows

Framework-independent domain package for Formbricks Workflows.

This package owns reusable workflow building blocks: contracts, validation, domain services, HTTP handler
abstractions, and runner-facing helpers. It should remain independent from `apps/web` and any specific web
framework so the same workflow logic can be reused across runtimes.

## Boundaries

- Do not import from `apps/web` or Next.js-specific APIs.
- Keep runtime adapters thin and explicit.
- Prefer narrow dependencies and pass app/runtime concerns through interfaces.

## Adding Actions And Triggers

Actions and triggers are modeled as typed nodes with data-only `config` objects. The discriminator lives on the
node (`actionType` or `triggerType`), not inside `config`.

To add an action:

1. Add the action id to `src/types/actions/enum.ts`.
2. Add a config schema and node schema under `src/types/actions/`.
3. Add the config schema to `WORKFLOW_ACTION_CONFIG_SCHEMAS`.
4. Add the node schema to `ZWorkflowActionNode`.
5. Add or update fixtures and tests that validate a full workflow document using the new action.

To add a trigger:

1. Add the trigger id to `src/types/triggers/enum.ts`.
2. Add a config schema, payload schema if needed, and node schema under `src/types/triggers/`.
3. Add the config schema to `WORKFLOW_TRIGGER_CONFIG_SCHEMAS`.
4. Add the node schema to `ZWorkflowTriggerNode`.
5. Add or update fixtures and tests that validate a full workflow document using the new trigger.

Keep config schemas focused on user-provided configuration. Runtime-only data belongs in trigger payloads, run
data, run logs, or service-layer inputs.
