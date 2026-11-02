# SpiceDB is the only authorization evaluator, and it fails closed

Every central `can()` and `assertCan()` decision is answered by SpiceDB (AuthZed) with `fully_consistent` checks, from every caller: pages, server actions, API v1, v2 and v3, MCP, the feedback gateway and scripts (ENG-2446). There is no legacy evaluator, cohort or environment switch to fall back to. A disabled client, a transport, resolver or projection failure is a typed operational error that propagates and refuses the request; it is never translated into an allow or a deny. A genuine SpiceDB denial stays `false`, and `assertCan()` keeps its authorization error. The engine-independent contract lives in `apps/web/lib/authorization/` (see its README).

## Considered Options

- **Keep the legacy rule evaluator as a fallback when AuthZed is unavailable**: rejected, because two evaluators drift apart (the billing-role exclusion diverged between them, ENG-2340), and a fallback that allows on failure is a bypass anyone who can degrade AuthZed can trigger.

## Consequences

- AuthZed is a hard runtime dependency for self-hosters: without it, every authorization check refuses.
- A new resource type either gets a SpiceDB definition, which self-hosters apply as an upgrade step, or is authorized at the workspace level as creatives are ([ADR-0010](0010-workspace-level-authorization.md)).
