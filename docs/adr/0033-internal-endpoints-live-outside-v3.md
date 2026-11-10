# Dashboard-only endpoints live at unversioned `/api/internal`, and `/api/v3` is reserved for the public contract

An endpoint that only our own UI calls lives at `/api/internal/<resource>`: session auth, no OpenAPI entry, no version segment and no stability promise. It is built like a v3 route in every other way (ENG-1668). `/api/v3` is reserved for the published contract we deprecate with notice instead of changing. New endpoints start internal and move to `/api/v3`, rather than gaining a public twin, once an external caller needs them; a feature built for external callers from day one starts public (ADR 0002). The URL carries the signal because it is the only thing an outside caller sees, and there is no version segment because the only client ships in the same commit as the route.

## Considered Options

- **Keep internal routes under `/api/v3`, marked by `auth: "session"` and a missing spec entry**: how taxonomy and tags shipped. A caller reading `/api/v3/...` still can't tell a contract from a UI helper.
- **`/api/v3/internal/...`, or a Next.js `(internal)` route group**: the first keeps a version number on endpoints that aren't versioned; the second doesn't change the URL at all.
- **A `visibility` flag on the wrapper**: the same fact stated twice, in two places that can disagree.

## Consequences

- Internal does not mean lax: the review bar is the same as v3. Moving a server action onto a route keeps the action's authorization checks, audit events and rate limits, and while both exist a gate change lands on both through the one gate function (`CODING_STANDARDS.md`, "API Design").
- MCP is a public surface: an operation an MCP tool calls is a public contract, whichever HTTP routes call it too.
- The internal API needs versioning the day it gains a consumer we don't ship in the same commit (a mobile app, the CLI, another service).
- Session-only UI routes outside `/api/internal` are exceptions waiting to move there: older ones under `/api/v3` (ENG-2533, ENG-3984), and the UI routes in the `(internal)` route group served under `/api/` (survey export and attachment exports, for example). The group's proxy auth hooks (`envoy-auth`, `traefik-auth`) are not UI routes and stay.
- The `feedbackRecords/[[...path]]` Hub proxy stays under `/api/v3`: it is a documented public pass-through to the Hub API.
