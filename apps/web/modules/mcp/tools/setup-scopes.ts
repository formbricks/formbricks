/**
 * The scopes of the setup tools (ADR 0018), declared once so no tool file spells them inline. Each is a
 * separate consent choice: `account:read` for the context, `workspaces:write`, `organizations:write` and
 * `members:write` for the writes.
 *
 * A scope is only the first gate. Every operation enforces the real role check itself, so a connection
 * holding `organizations:write` still cannot rename an organization unless its person is an owner or
 * manager.
 */
export const ACCOUNT_READ_SCOPES: [string, ...string[]] = ["account:read"];
export const WORKSPACE_WRITE_SCOPES: [string, ...string[]] = ["workspaces:write"];
export const ORGANIZATION_WRITE_SCOPES: [string, ...string[]] = ["organizations:write"];
export const MEMBER_READ_SCOPES: [string, ...string[]] = ["members:read"];
export const MEMBER_WRITE_SCOPES: [string, ...string[]] = ["members:write"];
