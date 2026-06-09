# Formbricks Workflows

This package contains the core functionality of Formbricks Workflows, including the types and validations.

## Glossary and States Update Draft

Add `archived` to `WorkflowStatus`: `draft | enabled | disabled | archived`.

Archived workflows are soft-deleted workflow records. They never execute and are excluded from list/get
operations by default. `includeArchived=true` includes them.

Allowed archive transitions:

- `draft -> archived`
- `disabled -> archived`

Unarchive transitions:

- `archived -> disabled`

Unarchiving does not automatically resume execution. A user or API must explicitly enable the workflow after
unarchiving.
