---
status: proposed
---

# Agent-first: the only human UI is the account shell

Everything on the platform, from authoring surveys to reading responses, is done by an agent through MCP and `/api/v3`. People keep only the account shell: sign-up and login, organization management, connecting an agent, creating agent connections, and OAuth consent. The editors, builders, response tables and result views are retired, because an agent writes the same documents faster than a form does and a second human path would drift from the agent one (this is an experiment on a branch that is never merged, to see where the journey goes).

## Considered Options

- **Keep a read-only results view** so people can watch what agents did: rejected. Observation goes through the audit log and the agent itself, and a view is a UI to keep.
- **No UI at all, org and keys through the agent too**: rejected. OAuth consent and key creation need a person at a browser, and an agent cannot safely mint its own credentials.

## Consequences

- Every capability that was UI-only needs an MCP tool or is deleted. The 14 session-only v3 routes move to API key and OAuth auth.
- The respondent runtime (SDK, survey renderer, client API, hosted survey pages) is unchanged.
- v1 and v2 management APIs and their docs are deleted along with the UI.
