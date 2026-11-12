import type { TMcpScopeFamily } from "@/modules/auth/lib/oauth-urls";

/**
 * The MCP permission registry: every category and permission a grant is made of, the scope family that
 * caps each permission, and the access levels it offers (`GLOSSARY.md`, "MCP access"; ADR-0041).
 *
 * This is the one list. The tool guard reads it to turn a tool's declared permissions into the scopes a
 * token must hold, and the consent screen, Authorized apps, the grant migration and the docs read it for
 * what a grant can contain. A permission is added here, never inline in one of those places.
 *
 * Rules for a new entry:
 * - A new permission in an existing category uses that category's scope family, so it needs no OAuth
 *   migration (ADR-0041).
 * - A new category gets a new scope family, with the two data migrations described on
 *   `MCP_SCOPE_FAMILIES` in `oauth-urls.ts` (ADR-0040).
 * - A permission whose tools only read offers No access and Read; it never offers a level no tool uses.
 */

/** How far a permission goes. Write includes Read, and includes deleting. */
export type TMcpAccessLevel = "none" | "read" | "write";

/**
 * A scope family that caps a permission. `audience` is in the catalogue before it is an OAuth scope:
 * ENG-7151 adds `audience:read` to `MCP_SCOPE_FAMILIES` with its migrations. Until then no token holds it,
 * so a tool declaring an Audience permission is refused for every OAuth token — it fails closed.
 */
export type TMcpPermissionScopeFamily = TMcpScopeFamily | "audience";

export const MCP_PERMISSION_CATEGORIES = [
  "surveys",
  "responses",
  "workflows",
  "dashboards",
  "feedback",
  "audience",
] as const;

export type TMcpPermissionCategory = (typeof MCP_PERMISSION_CATEGORIES)[number];

type TMcpPermissionDefinition = {
  category: TMcpPermissionCategory;
  scopeFamily: TMcpPermissionScopeFamily;
  levels: readonly TMcpAccessLevel[];
};

const READ_WRITE = ["none", "read", "write"] as const;
const READ_ONLY = ["none", "read"] as const;

/** Keyed by permission, in the order the matrix lists them inside each category. */
export const MCP_PERMISSIONS = {
  surveys: { category: "surveys", scopeFamily: "surveys", levels: READ_WRITE },
  creatives: { category: "surveys", scopeFamily: "surveys", levels: READ_WRITE },
  surveyStyling: { category: "surveys", scopeFamily: "surveys", levels: READ_WRITE },
  responses: { category: "responses", scopeFamily: "responses", levels: READ_WRITE },
  tags: { category: "responses", scopeFamily: "responses", levels: READ_WRITE },
  workflows: { category: "workflows", scopeFamily: "workflows", levels: READ_WRITE },
  workflowRuns: { category: "workflows", scopeFamily: "workflows", levels: READ_ONLY },
  charts: { category: "dashboards", scopeFamily: "dashboards", levels: READ_WRITE },
  dashboards: { category: "dashboards", scopeFamily: "dashboards", levels: READ_WRITE },
  feedbackRecords: { category: "feedback", scopeFamily: "feedbackRecords", levels: READ_WRITE },
  feedbackDatasets: { category: "feedback", scopeFamily: "feedbackRecords", levels: READ_ONLY },
  contacts: { category: "audience", scopeFamily: "audience", levels: READ_ONLY },
  contactAttributes: { category: "audience", scopeFamily: "audience", levels: READ_ONLY },
  segments: { category: "audience", scopeFamily: "audience", levels: READ_ONLY },
  actionClasses: { category: "audience", scopeFamily: "audience", levels: READ_ONLY },
} as const satisfies Record<string, TMcpPermissionDefinition>;

export type TMcpPermission = keyof typeof MCP_PERMISSIONS;

/**
 * What a tool needs: one permission at a minimum access level. The level is typed per permission, so a
 * requirement can only name a level its permission offers, and never No access (which would gate on
 * nothing).
 */
export type TMcpPermissionRequirement = {
  [P in TMcpPermission]: {
    permission: P;
    level: Exclude<(typeof MCP_PERMISSIONS)[P]["levels"][number], "none">;
  };
}[TMcpPermission];

/**
 * The scope a token needs for a requirement today: the permission's scope family at the required level
 * (`surveys:read`, `dashboards:write`). Until grants exist (ENG-7149) this is the whole check, which is
 * what keeps every tool allowed and refused exactly as it was when tools declared scopes.
 */
export const getMcpPermissionScope = ({ permission, level }: TMcpPermissionRequirement): string =>
  `${MCP_PERMISSIONS[permission].scopeFamily}:${level}`;

/**
 * Runtime check of a requirement, for the places the type system cannot reach (a cast, a computed list).
 * True only for a registered permission at a level it offers other than No access.
 */
export const isMcpPermissionRequirement = (value: unknown): value is TMcpPermissionRequirement => {
  if (typeof value !== "object" || value === null) return false;
  const { permission, level } = value as { permission?: unknown; level?: unknown };
  if (typeof permission !== "string" || !Object.hasOwn(MCP_PERMISSIONS, permission)) return false;
  const offered: readonly string[] = MCP_PERMISSIONS[permission as TMcpPermission].levels;
  return typeof level === "string" && level !== "none" && offered.includes(level);
};
