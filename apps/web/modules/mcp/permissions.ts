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
 * A scope family that caps a permission. `audience` is read-only (`MCP_READ_ONLY_SCOPE_FAMILIES`): it has
 * `audience:read` and no write scope, so its permissions offer No access and Read only.
 */
export type TMcpPermissionScopeFamily = TMcpScopeFamily;

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
  /** The permission's English name, as the spec's catalogue and the "not permitted" error give it. */
  name: string;
  category: TMcpPermissionCategory;
  scopeFamily: TMcpPermissionScopeFamily;
  levels: readonly TMcpAccessLevel[];
};

const READ_WRITE = ["none", "read", "write"] as const;
const READ_ONLY = ["none", "read"] as const;

/** Keyed by permission, in the order the matrix lists them inside each category. */
export const MCP_PERMISSIONS = {
  surveys: { name: "Surveys", category: "surveys", scopeFamily: "surveys", levels: READ_WRITE },
  creatives: { name: "Creatives", category: "surveys", scopeFamily: "surveys", levels: READ_WRITE },
  surveyStyling: { name: "Survey styling", category: "surveys", scopeFamily: "surveys", levels: READ_WRITE },
  responses: { name: "Responses", category: "responses", scopeFamily: "responses", levels: READ_WRITE },
  tags: { name: "Tags", category: "responses", scopeFamily: "responses", levels: READ_WRITE },
  workflows: { name: "Workflows", category: "workflows", scopeFamily: "workflows", levels: READ_WRITE },
  workflowRuns: { name: "Workflow runs", category: "workflows", scopeFamily: "workflows", levels: READ_ONLY },
  charts: { name: "Charts", category: "dashboards", scopeFamily: "dashboards", levels: READ_WRITE },
  dashboards: { name: "Dashboards", category: "dashboards", scopeFamily: "dashboards", levels: READ_WRITE },
  feedbackRecords: {
    name: "Feedback records",
    category: "feedback",
    scopeFamily: "feedbackRecords",
    levels: READ_WRITE,
  },
  feedbackDatasets: {
    name: "Feedback datasets",
    category: "feedback",
    scopeFamily: "feedbackRecords",
    levels: READ_ONLY,
  },
  contacts: { name: "Contacts", category: "audience", scopeFamily: "audience", levels: READ_ONLY },
  contactAttributes: {
    name: "Contact attributes",
    category: "audience",
    scopeFamily: "audience",
    levels: READ_ONLY,
  },
  segments: { name: "Segments", category: "audience", scopeFamily: "audience", levels: READ_ONLY },
  actionClasses: { name: "Action classes", category: "audience", scopeFamily: "audience", levels: READ_ONLY },
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
 * What a permission needs beside itself to be any use: its tools also return another permission's data,
 * so they declare that permission too and are refused without it. Chart reads return feedback records,
 * so they need Charts and Feedback records: Read (spec, user story 27). The consent screen shows these
 * as hints; the tool declarations stay what enforces them.
 *
 * Workflow runs has none: `get_workflow_run` declares Workflow runs: Read alone, so a client upgraded
 * with `workflows:read` keeps it (spec story 40), and leaves out the run's respondent-derived fields for a
 * grant without Responses: Read instead of refusing.
 */
export const MCP_PERMISSION_DEPENDENCIES: Partial<
  Record<TMcpPermission, readonly TMcpPermissionRequirement[]>
> = {
  charts: [{ permission: "feedbackRecords", level: "read" }],
  // `list_contacts` returns each contact's attribute values; `list_segments`, filters naming literal ones.
  contacts: [{ permission: "contactAttributes", level: "read" }],
  segments: [{ permission: "contactAttributes", level: "read" }],
};

/**
 * The scope a token needs for a requirement: the permission's scope family at the required level
 * (`surveys:read`, `dashboards:write`). The scope caps the grant (ADR-0041), so the tool guard checks it
 * before the connection's grant; for an API key, which has no grant, it is the whole check.
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
