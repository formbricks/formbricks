# Dashboard-only endpoints live at unversioned `/api/internal`, and `/api/v3` is only the public contract

An endpoint that exists only to serve our own UI is served from `/api/internal/<resource>`: session auth, no OpenAPI entry, no version segment and no stability promise (ENG-1668). It is built like a v3 route in every other way: `withV3ApiWrapper`, strict Zod bodies and queries, RFC 9457 problems, workspace authorization, audit logging and rate limits. `/api/v3` then means one thing: the published, spec'd contract we deprecate with notice instead of changing. New endpoints start internal and move to `/api/v3` when an external caller (an API key, an integration, an MCP tool that writes) needs them. They move rather than gain a public twin, and the app follows them to the public route. A feature built for external callers from day one starts public (ADR 0002). The URL carries the signal because it is the only thing an outside caller sees: a `v3` prefix on an endpoint that may change next week promises something we aren't promising. There is no version segment because the only client ships in the same commit as the route.

## Considered Options

- **Keep internal routes under `/api/v3`, marked only by `auth: "session"` and a missing spec entry**: this is how taxonomy and tags shipped. It protects us at most, and only if a guard reads the metadata. A caller reading `/api/v3/...` still can't tell a contract from a UI helper.
- **`/api/v3/internal/...`**: keeps a version number on endpoints that aren't versioned.
- **A Next.js `(internal)` route group**: groups the files without changing the URL, so the endpoint still serves from a path that says nothing.
- **A `visibility` flag on the wrapper**, with or without the path: states the same fact twice, in two places that can disagree.

## Consequences

- Internal does not mean lax: the review bar is the same as v3, and only the auth mode and the spec entry differ.
- Moving a server action onto a route changes the transport, not the rules: the route keeps the action's authorization checks, audit events and rate limits. While an action and the route that replaces it both exist, a gate change lands on both, through the one gate function every entry point calls (`CODING_STANDARDS.md`, "API Design").
- MCP is a public surface even where the HTTP route is internal. The tools call the same `lib/operations.ts` the routes do, so reshaping an operation an MCP tool uses is a public change.
- Promotion costs a route move and a client change, not a one-line flag. Next to writing the spec entry and reviewing the shape for outside callers, that is small.
- The internal API needs versioning the day it gains a consumer we don't ship in the same commit (a mobile app, the CLI, another service).
- Not done yet. The pre-existing session-only routes still sit under `/api/v3`: the `unify-feedback/taxonomy/*` routes, `tags` (still published in the spec too, ENG-2533), `gateway/token`, `feedbackRecords/token` and `surveys/templates`. Most of the dashboard still writes through server actions; ENG-3984 moves them onto `/api/internal`. No CI check ties the route tree to the spec yet (ENG-3984 adds one), so for now the rule is held by `CODING_STANDARDS.md` and review. The `feedbackRecords/[[...path]]` Hub proxy stays under `/api/v3` because it forwards API keys.
- Charts and dashboards were meant to be internal (they hold Cube queries and layout blobs). They went public instead, by the exception in ADR 0002.
