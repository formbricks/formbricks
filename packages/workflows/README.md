# Formbricks Workflows

Framework-independent domain package for Formbricks Workflows.

This package owns reusable workflow building blocks: contracts, validation, domain services, HTTP handler
abstractions, and runner-facing helpers. It should remain independent from `apps/web` and any specific web
framework so the same workflow logic can be reused across runtimes.

## Boundaries

- Do not import from `apps/web` or Next.js-specific APIs.
- Keep runtime adapters thin and explicit.
- Prefer narrow dependencies and pass app/runtime concerns through interfaces.
