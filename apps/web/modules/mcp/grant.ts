import {
  MCP_PERMISSIONS,
  type TMcpAccessLevel,
  type TMcpPermission,
  type TMcpPermissionRequirement,
} from "./permissions";

/**
 * A grant (GLOSSARY.md "Grant", ADR-0041): what one user allows one MCP client to do. Stored by Formbricks
 * (`grant-store.ts`), read on every MCP request, and capped by the client's OAuth scopes.
 *
 * This module is the grant's pure half: its shape, how a requested set of scopes becomes one, and whether
 * it covers what a tool needs. No I/O, so the guard, authentication and the consent hook share one
 * definition.
 */

/**
 * Which organizations and workspaces a grant reaches (GLOSSARY.md "Organization & workspace access"):
 * All access, Only selected organizations (and every workspace in them, later ones included), or Only
 * selected workspaces. Enforced in SpiceDB through `can()` (ADR-0042).
 */
export type TMcpGrantAccess = "all" | "organizations" | "workspaces";

/** A grant's organization & workspace access with what it selects. */
export type TMcpGrantAccessSelection =
  | { access: "all" }
  | { access: "organizations"; organizationIds: string[] }
  | { access: "workspaces"; workspaceIds: string[] };

/** The most organizations or workspaces one grant selects: far above a person's own memberships. */
export const MAX_MCP_GRANT_SELECTIONS = 500;

/** What a consent request or an Edit chose: the permissions, and the access when it names one. */
export type TRequestedMcpGrant = { permissions: TMcpGrantPermissions; access?: TMcpGrantAccessSelection };

/** An access level per permission. A permission that is absent has No access. */
export type TMcpGrantPermissions = Partial<Record<TMcpPermission, Exclude<TMcpAccessLevel, "none">>>;

/** What a request carries of its grant: enough to decide every tool call without another read. */
export type TMcpGrant = { access: TMcpGrantAccess; permissions: TMcpGrantPermissions };

const RANK: Record<TMcpAccessLevel, number> = { none: 0, read: 1, write: 2 };

const isOfferedLevel = (permission: TMcpPermission, level: unknown): level is "read" | "write" =>
  (level === "read" || level === "write") &&
  (MCP_PERMISSIONS[permission].levels as readonly string[]).includes(level);

/**
 * Reads a stored permission map. Fails closed entry by entry: an unknown permission, or a level the
 * permission does not offer, is dropped (No access) rather than trusted, so a corrupt or hand-edited row
 * can only ever give less.
 */
export const parseMcpGrantPermissions = (value: unknown): TMcpGrantPermissions => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const permissions: TMcpGrantPermissions = {};
  for (const [permission, level] of Object.entries(value)) {
    if (!Object.hasOwn(MCP_PERMISSIONS, permission)) continue;
    if (isOfferedLevel(permission as TMcpPermission, level)) {
      permissions[permission as TMcpPermission] = level;
    }
  }
  return permissions;
};

/**
 * The grant a client's requested scopes ask for: every permission whose scope family the scopes hold,
 * at that family's level (`<family>:write` gives Write, `<family>:read` Read), capped at the highest level
 * the permission offers. What Allow saves until the consent screen lets the user pick (ENG-7150).
 */
export const getMcpGrantPermissionsForScopes = (scopes: readonly string[]): TMcpGrantPermissions => {
  const held = new Set(scopes);
  const permissions: TMcpGrantPermissions = {};
  for (const [permission, { scopeFamily, levels }] of Object.entries(MCP_PERMISSIONS)) {
    const offered: readonly string[] = levels;
    if (held.has(`${scopeFamily}:write`)) {
      permissions[permission as TMcpPermission] = offered.includes("write") ? "write" : "read";
    } else if (held.has(`${scopeFamily}:read`)) {
      permissions[permission as TMcpPermission] = "read";
    }
  }
  return permissions;
};

const readPermissions = (requested: unknown): TMcpGrantPermissions | null => {
  if (typeof requested !== "object" || requested === null || Array.isArray(requested)) return null;
  const entries = Object.entries(requested);
  if (entries.length === 0) return null;
  const permissions: TMcpGrantPermissions = {};
  for (const [permission, level] of entries) {
    if (!Object.hasOwn(MCP_PERMISSIONS, permission)) return null;
    if (!isOfferedLevel(permission as TMcpPermission, level)) return null;
    permissions[permission as TMcpPermission] = level;
  }
  return permissions;
};

/** A non-empty, bounded list of ids, deduplicated and sorted; `null` for anything else. */
const readSelection = (ids: unknown): string[] | null => {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_MCP_GRANT_SELECTIONS) return null;
  if (!ids.every((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 255)) {
    return null;
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
};

const ACCESS_FIELDS = ["access", "organizationIds", "workspaceIds"] as const;

/**
 * Reads the organization & workspace access a request names: `access` and, for a selection, the
 * matching non-empty id list and no other. `undefined` when the request names none, `null` when what it
 * names is not one the editor could have sent.
 */
const readAccess = (value: Record<string, unknown>): TMcpGrantAccessSelection | null | undefined => {
  if (!ACCESS_FIELDS.some((field) => Object.hasOwn(value, field))) return undefined;
  const { access, organizationIds, workspaceIds } = value;
  switch (access) {
    case "all":
      return organizationIds === undefined && workspaceIds === undefined ? { access } : null;
    case "organizations": {
      const ids = workspaceIds === undefined ? readSelection(organizationIds) : null;
      return ids ? { access, organizationIds: ids } : null;
    }
    case "workspaces": {
      const ids = organizationIds === undefined ? readSelection(workspaceIds) : null;
      return ids ? { access, workspaceIds: ids } : null;
    }
    default:
      return null;
  }
};

/**
 * Reads the grant a consent request or an Edit chose (`mcp_grant` beside `accept` on
 * `POST /oauth2/consent`, the body of `PATCH /api/internal/mcp-grants/{clientId}`):
 * `{ permissions: { <permission>: "read" | "write" }, access?, organizationIds? | workspaceIds? }`.
 * Unlike {@link parseMcpGrantPermissions}, which reads a stored row and drops what it doesn't know, this
 * refuses the whole request (`null`) on anything it doesn't expect: an unknown field or permission, a
 * level the permission doesn't offer, a grant that gives nothing, or a selection with nothing picked,
 * none of which the editor sends.
 */
export const parseRequestedMcpGrant = (value: unknown): TRequestedMcpGrant | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  if (
    Object.keys(fields).some(
      (key) => key !== "permissions" && !(ACCESS_FIELDS as readonly string[]).includes(key)
    )
  ) {
    return null;
  }
  const permissions = readPermissions(fields.permissions);
  if (!permissions) return null;
  const access = readAccess(fields);
  if (access === null) return null;
  return access ? { permissions, access } : { permissions };
};

/**
 * `permissions` held to `cap`: each permission at the lower of the two levels, and dropped (No access)
 * when the cap gives it nothing. The cap is what the client's scopes ask for
 * ({@link getMcpGrantPermissionsForScopes}), since scopes only ever cap a grant (ADR-0041). The consent
 * hook saves a chosen grant through this, so a request can never give more than the client asked for.
 */
export const capMcpGrantPermissions = (
  permissions: TMcpGrantPermissions,
  cap: TMcpGrantPermissions
): TMcpGrantPermissions => {
  const capped: TMcpGrantPermissions = {};
  for (const [permission, level] of Object.entries(permissions) as [
    TMcpPermission,
    Exclude<TMcpAccessLevel, "none">,
  ][]) {
    const limit = cap[permission];
    if (!limit) continue;
    capped[permission] = RANK[level] <= RANK[limit] ? level : limit;
  }
  return capped;
};

/**
 * True when no permission in `permissions` goes above `cap`. Authorized apps' Edit refuses a grant that
 * fails this rather than capping it, since the editor never offers a level above the cap (ADR-0041).
 */
export const isMcpGrantWithinCap = (permissions: TMcpGrantPermissions, cap: TMcpGrantPermissions): boolean =>
  (Object.entries(permissions) as [TMcpPermission, Exclude<TMcpAccessLevel, "none">][]).every(
    ([permission, level]) => RANK[level] <= RANK[cap[permission] ?? "none"]
  );

/** True when the grant gives the requirement's permission at least the level it needs. */
export const mcpGrantAllows = (grant: TMcpGrant, { permission, level }: TMcpPermissionRequirement): boolean =>
  RANK[grant.permissions[permission] ?? "none"] >= RANK[level];

const LEVEL_NAMES = { read: "Read", write: "Write" } as const;

/** "Surveys: Write", the way the docs and the "not permitted" error name a requirement. */
export const describeMcpPermissionRequirement = ({ permission, level }: TMcpPermissionRequirement): string =>
  `${MCP_PERMISSIONS[permission].name}: ${LEVEL_NAMES[level]}`;
