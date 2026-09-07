# AuthZed epic integration

This file records the reconciliation used to integrate the AuthZed epic with the product and security
changes on `main` before the direct-cutover work began.

## Merge contract

- Epic parent: `3dbebde2d3029a63f42599910ac5b8acc58c712a`.
- Main parent: `12b8aa1a3d4128b7c989a5ebd5fb39b1f5084276`.
- Current `main` is authoritative for product behavior, security fixes, package infrastructure, and
  generated configuration.
- `epic/authzed` is authoritative for the Formbricks authorization contract, SpiceDB schema, client,
  projection, repair, deployment, and operations implementation.
- The synchronization is a real merge commit so `main` remains an ancestor of the epic. It must not
  be squash-merged into `epic/authzed`.

The already-reviewed synchronization merge from PR 8863 was replayed as the AuthZed reconciliation
ledger on top of the current `main`, followed in order by the eight AuthZed epic changes that landed
after that synchronization. This avoids resolving unrelated historical conflicts a second time while
preserving the reviewed AuthZed behavior.

## Explicit conflict decisions

### Rate-limit configuration

The current `main` integration mutation limit and the AuthZed feedback-source, historical-import,
chart, feedback-directory, and feedback-record limits are all retained. They protect independent
mutation surfaces and are not alternatives.

### API-key settings page

The AuthZed `organization.manage_api_keys` page gate is retained. The obsolete `isReadOnly` prop is
not restored because the current `ApiKeyList` contract no longer exposes it; authorization happens
before the list is loaded.

### Authorization and feedback surfaces

Current product request shapes, tenant scoping, and rate-limit behavior are retained while the
AuthZed surface context and central authorization calls remain in place. No legacy authorization path
is revived to resolve an integration conflict.

## Validation gate

Before this merge can land, the combined tree must pass the frozen install, dependency build,
authorization/AuthZed unit suites, typecheck, schema validation, Docker and Helm contract tests,
AuthZed smoke test, and production web build. The final tree must also pass the authorization resource
inventory so every Prisma model introduced by `main` is classified.
