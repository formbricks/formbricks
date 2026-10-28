---
status: proposed
---

# Agent-led setup: a guide the agent follows, not a form the person fills in

A new account is set up by the person's own agent. The person signs up, connects the MCP server, and pastes one line, "Set up my Formbricks account by following `<instance>/agents/setup.md`". The agent calls `get_account_context`, works out whether the person is a new owner, an invited member or a returning user, and follows the Setup guide: interview, research the person's site and brand, create the first workspace, apply branding, propose a first use case, draft a branded link survey, publish it on approval. This amends ADR 0015, which kept organization and workspace management in the account shell; it is an experiment on the same never-merged branch.

## Considered Options

- **A stored onboarding state** (a table or flags for progress): rejected. Everything the guide needs (role, workspaces, surveys, branding) is already data, so the state is derived from the account context and the guide is safe to rerun.
- **A server-side brand lookup** (a third-party brand API from a domain): rejected. The agent already has the person's site, files and repo and can browse; a server call adds a paid vendor and sends the person's company to it. The server only offers the write tools.
- **An authenticated-only guide** (served through the MCP prompt and server instructions only): rejected. The paste prompt works in any agent, including before the MCP server is connected, so the guide is a public page with no secrets; the MCP prompt serves the same text.
- **Letting an agent create organizations**: rejected. Sign-up creates the organization, on Cloud and self-host alike; the first workspace is the agent's job.
- **A new OAuth scope for setup tools**: rejected for now. A scope needs data migrations that grant it to existing clients. The writes reuse `surveys:write` (ADR 0011) and the operation enforces the real role check, so the scope is only the first gate.
- **Keeping the mutating screens beside the agent path**: rejected. Two paths drift (ADR 0015); the pages become read-only with an "ask your agent" prompt instead.

## Consequences

- New tools: `get_account_context`, `update_organization`, `create_workspace`, `update_workspace`, `set_workspace_branding` and `invite_member`. Agents still cannot delete workspaces or change roles. An invite changes nothing until the call is confirmed.
- Because the setup tools reuse `surveys:write`, an agent connection that may edit surveys can also create workspaces, set branding and, as an owner or manager's agent, invite members. The confirmation on invites and the role check in each operation are what bound that.
- A workspace can only be created by an agent. An organization can now have zero workspaces, and every screen and tool has to cope.
- The setup guide, the MCP prompt and the server instructions come from one in-repo source with the instance's own URL filled in; a test fails if the guide names a tool that is not registered.
- Members, Teams, Workspaces and organization settings are read-only. Consent, agent connections, account security, billing and deletes stay with the person.
- Brand research reads untrusted content (sites, files, repos). The guide says so and asks for approval before every write; the server enforces confirmation for invites.
- The new operations have no REST route or OpenAPI entry yet. They live in `apps/web/app/api/v3/*/lib` so a route can be added.
