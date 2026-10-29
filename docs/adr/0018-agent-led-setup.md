---
status: proposed
---

# Agent-led setup: a guide the agent follows, not a form the person fills in

A new account is set up by the person's own agent. The person signs up, connects the MCP server, and pastes one line, "Set up my Formbricks account by following `<instance>/agents/setup.md`". The agent calls `get_account_context`, works out whether the person is a new owner, an invited member or a returning user, and follows the Setup guide: interview, research the person's site and brand, create the first workspace, apply branding, propose a first use case, draft a branded link survey, publish it on approval. This amends ADR 0015, which kept organization and workspace management in the account shell; it is an experiment on the same never-merged branch.

## Considered Options

- **A stored onboarding state** (a table or flags for progress): rejected. Everything the guide needs (role, workspaces, surveys, branding) is already data, so the state is derived from the account context and the guide is safe to rerun.
- **A server-side brand lookup** (a third-party brand API from a domain): rejected. The agent already has the person's site, files and repo and can browse; a server call adds a paid vendor and sends the person's company to it. The server only offers the write tools.
- **An authenticated-only guide** (served through the MCP prompt and server instructions only): rejected. The paste prompt works in any agent, including before the MCP server is connected, so the guide is a public page with no secrets; the MCP prompt serves the same text.
- **Letting an agent create the first organization**: rejected. Sign-up creates it, on Cloud and self-host alike; the first workspace is the agent's job. A *second* organization is different: `create_organization` makes one for a signed-in person on an instance that allows several, and its result sends the agent back through the Setup guide's new-owner path.
- **Reusing `surveys:write` for the setup writes**: rejected. Creating workspaces, creating or renaming organizations and sending invitations are administrative acts, and an enterprise customer must be able to let an agent author surveys without granting them. The setup tools have dedicated scopes instead (below).
- **Keeping the mutating screens beside the agent path**: rejected. Two paths drift (ADR 0015); the pages become read-only with an "ask your agent" prompt instead.

## Decision: dedicated OAuth scopes

Seven new scopes, each a separate choice on the consent screen. The first four started the decision; round 3 added `members:read`, `teams:read` and `teams:write` for the people side of an organization. Account, workspace and organization scopes sit in the group "Account and setup", members and teams in "Members and teams":

| Scope                 | Tools                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `account:read`        | `get_account_context`; also admits `list_workspaces`                                     |
| `workspaces:write`    | `create_workspace`, `update_workspace`, `set_workspace_branding`                         |
| `organizations:write` | `create_organization`, `update_organization`                                             |
| `members:read`        | `list_members`                                                                           |
| `members:write`       | `invite_member`, `update_member_role`, `remove_member`, `resend_invite`, `delete_invite` |
| `teams:read`          | `list_teams`                                                                             |
| `teams:write`         | `create_team`, `update_team`, `delete_team`                                              |

`account:read`, `workspaces:write` and `organizations:write` are single-level: `account:read` has no write twin and the two writes have no read twin. `members` and `teams` come as read and write pairs, because listing people exposes their email addresses and roles and a person must be able to allow that without allowing removals. Ticking a write ticks the read of the same family, as everywhere on the consent screen. A scope is only the first gate; each operation still checks the person's organization role (owner or manager), so holding `members:write` lets an agent invite or remove only when its person could, and teams additionally need the Enterprise teams licence. `account:read` and `workspaces:write` start ticked on the consent screen, because the Setup guide cannot start without them; `organizations:write`, `members:read`, `members:write`, `teams:read` and `teams:write` start unticked, so reading colleagues' emails, changing who is in the organization and managing teams are each a deliberate choice. An API key gets `account:read` always and `workspaces:write` when it has `manage` on a workspace, which lets it call `update_workspace` and `set_workspace_branding` on that workspace but never `create_workspace` (creating a workspace is an organization-level change, so the operation answers 403 to a key); it never gets `organizations:write` or any members or teams scope, because those are organization-level and a key has no organization role for the operations' owner and manager checks to hold against.

Two data migrations follow the rule in `oauth-urls.ts`: `20261029100000_grant_agent_setup_scopes` appends the four scopes to the `oauthResource` row, and `20261029100100_grant_agent_setup_scopes_to_clients` appends them to registered clients, mirroring what each already holds (`account:read` for any MCP `:read` scope, the three writes for any MCP `:write` scope, `skipConsent` clients skipped). Registration is only a ceiling, so existing write clients can now be offered `organizations:write` and `members:write`, but nothing is granted until the person ticks them.

Round 3 adds two more, by the same rule: `20261029110000_grant_members_teams_scopes` appends `members:read`, `teams:read` and `teams:write` to the `oauthResource` row, and `20261029110100_grant_members_teams_scopes_to_clients` appends `members:read` and `teams:read` to clients holding any MCP `:read` scope and `teams:write` to clients holding any `:write` scope (`members:write` already went out with the first pair; `skipConsent` clients are skipped).

## Consequences

- New tools: `get_account_context`, `update_organization`, `create_organization`, `create_workspace`, `update_workspace`, `set_workspace_branding` and `invite_member`. Round 3 adds `list_members`, `update_member_role`, `remove_member`, `resend_invite`, `delete_invite`, `list_teams`, `create_team`, `update_team` and `delete_team`. Agents still cannot delete workspaces. An invite changes nothing until the call is confirmed.
- An agent connection that may edit surveys can no longer create workspaces, set branding or invite members unless the person also approved the matching scope. Existing connections keep what they were granted and are asked for the new scopes at their next sign-in.
- A workspace can only be created by an agent. An organization can now have zero workspaces, and every screen and tool has to cope.
- The setup guide, the MCP prompt and the server instructions come from one in-repo source with the instance's own URL filled in; a test fails if the guide names a tool that is not registered.
- Members, Teams, Workspaces and organization settings are read-only. Consent, agent connections, account security, billing and deletes stay with the person.
- Brand research reads untrusted content (sites, files, repos). The guide says so and asks for approval before every write; the server enforces confirmation for invites.
- Every new operation has a REST route and a documented OpenAPI entry (`GET /api/v3/account/context`, `POST /api/v3/organizations`, `PATCH /api/v3/organizations/{organizationId}`, `POST /api/v3/organizations/{organizationId}/invites`, `POST /api/v3/workspaces`, `PATCH /api/v3/workspaces/{workspaceId}`, `PUT /api/v3/workspaces/{workspaceId}/branding`), so the MCP tools, the REST API and the organization switcher answer the same. The four organization-level routes take a signed-in session only, because an API key has no organization role. OAuth scopes are an MCP-layer concept: the REST layer authenticates a session or an API key and never sees them.
