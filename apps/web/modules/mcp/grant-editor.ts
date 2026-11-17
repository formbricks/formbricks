import { type TMcpGrantPermissions, capMcpGrantPermissions, isMcpGrantEmpty } from "./grant";
import {
  MCP_PERMISSIONS,
  MCP_PERMISSION_CATEGORIES,
  MCP_PERMISSION_DEPENDENCIES,
  type TMcpAccessLevel,
  type TMcpPermission,
  type TMcpPermissionCategory,
  type TMcpPermissionRequirement,
} from "./permissions";

/**
 * The grant editor's logic (ENG-7150): the permission matrix the consent screen shows, and Authorized
 * apps' Edit reuses (ENG-7152). Pure, so the components only render what this returns.
 *
 * Everything is read from the permission registry (`permissions.ts`): a permission or category added
 * there shows up in the matrix with no change here. `cap` is what the client's scopes ask for
 * (`getMcpGrantPermissionsForScopes`); no level above it can be chosen (ADR-0041).
 */

export type TMcpGrantEditorCategory = {
  category: TMcpPermissionCategory;
  permissions: TMcpPermission[];
};

/** A category row whose permissions are at different levels shows no single level. */
export type TMcpCategoryLevel = TMcpAccessLevel | "mixed";

export type TMcpLevelOption = { level: TMcpAccessLevel; disabled: boolean };

export type TMcpGrantPreset = "readOnly" | "selectAll" | "deselectAll";

const LEVELS: readonly TMcpAccessLevel[] = ["none", "read", "write"];
const RANK: Record<TMcpAccessLevel, number> = { none: 0, read: 1, write: 2 };

const PRESET_LEVEL: Record<TMcpGrantPreset, TMcpAccessLevel> = {
  readOnly: "read",
  selectAll: "write",
  deselectAll: "none",
};

const ALL_PERMISSIONS = Object.keys(MCP_PERMISSIONS) as TMcpPermission[];

const levelOf = (permissions: TMcpGrantPermissions, permission: TMcpPermission): TMcpAccessLevel =>
  permissions[permission] ?? "none";

/** The highest level `permission` can take under `cap`, and not above `wanted`. */
const reachableLevel = (
  permission: TMcpPermission,
  wanted: TMcpAccessLevel,
  cap: TMcpGrantPermissions
): TMcpAccessLevel => {
  const offered: readonly TMcpAccessLevel[] = MCP_PERMISSIONS[permission].levels;
  const limit = Math.min(RANK[wanted], RANK[levelOf(cap, permission)]);
  return [...offered].reverse().find((level) => RANK[level] <= limit) ?? "none";
};

const withLevel = (
  permissions: TMcpGrantPermissions,
  permission: TMcpPermission,
  level: TMcpAccessLevel
): TMcpGrantPermissions => {
  const { [permission]: _previous, ...rest } = permissions;
  return level === "none" ? rest : { ...rest, [permission]: level };
};

/**
 * The categories the matrix shows, each with its permissions, in the registry's order. A Dashboard
 * viewer, who can only ever give dashboard reads (ADR-0025), sees the Dashboards category alone.
 */
export const getMcpGrantEditorCategories = ({
  isDashboardViewer,
}: {
  isDashboardViewer: boolean;
}): TMcpGrantEditorCategory[] =>
  MCP_PERMISSION_CATEGORIES.filter((category) => !isDashboardViewer || category === "dashboards").map(
    (category) => ({
      category,
      permissions: ALL_PERMISSIONS.filter((permission) => MCP_PERMISSIONS[permission].category === category),
    })
  );

/**
 * The levels a toggle offers for `permissions` (one permission, or a category's): every level one of them
 * offers, disabled when none of them can take it under `cap`. A permission with only read tools never
 * offers Write.
 */
export const getMcpLevelOptions = (
  permissions: readonly TMcpPermission[],
  cap: TMcpGrantPermissions
): TMcpLevelOption[] =>
  LEVELS.filter((level) =>
    permissions.some((permission) =>
      (MCP_PERMISSIONS[permission].levels as readonly TMcpAccessLevel[]).includes(level)
    )
  ).map((level) => ({
    level,
    disabled: !permissions.some((permission) => reachableLevel(permission, level, cap) === level),
  }));

/** Sets one permission, never above what it offers or `cap` allows. No access removes it. */
export const setMcpPermissionLevel = (
  permissions: TMcpGrantPermissions,
  permission: TMcpPermission,
  level: TMcpAccessLevel,
  cap: TMcpGrantPermissions
): TMcpGrantPermissions => withLevel(permissions, permission, reachableLevel(permission, level, cap));

/** The highest level `permission` offers: Write, or Read for one with only read tools. */
const highestOfferedLevel = (permission: TMcpPermission): TMcpAccessLevel =>
  [...MCP_PERMISSIONS[permission].levels].reduce<TMcpAccessLevel>(
    (highest, level) => (RANK[level] > RANK[highest] ? level : highest),
    "none"
  );

/**
 * The level a category's permissions share, or `mixed` when they differ. A category whose permissions all
 * sit at their own highest level is at Write, though one of them (Workflow runs, Feedback datasets) only
 * goes up to Read: that is what the category's Write sets (`setMcpCategoryLevel`), so the row shows it.
 */
export const getMcpCategoryLevel = (
  permissions: TMcpGrantPermissions,
  categoryPermissions: readonly TMcpPermission[]
): TMcpCategoryLevel => {
  const levels = new Set(categoryPermissions.map((permission) => levelOf(permissions, permission)));
  if (levels.size === 1) return [...levels][0];
  const atTheirHighest = categoryPermissions.every(
    (permission) => levelOf(permissions, permission) === highestOfferedLevel(permission)
  );
  return atTheirHighest ? "write" : "mixed";
};

/** Sets every permission of a category to `level`, each as far as it and `cap` allow. */
export const setMcpCategoryLevel = (
  permissions: TMcpGrantPermissions,
  categoryPermissions: readonly TMcpPermission[],
  level: TMcpAccessLevel,
  cap: TMcpGrantPermissions
): TMcpGrantPermissions =>
  categoryPermissions.reduce(
    (next, permission) => setMcpPermissionLevel(next, permission, level, cap),
    permissions
  );

/**
 * A preset over the permissions the editor shows: Read-only sets each to Read, Select all to the highest
 * level it offers, Deselect all to No access; always within `cap`.
 */
export const applyMcpGrantPreset = (
  preset: TMcpGrantPreset,
  shown: readonly TMcpPermission[],
  cap: TMcpGrantPermissions
): TMcpGrantPermissions => {
  const level = PRESET_LEVEL[preset];
  return shown.reduce<TMcpGrantPermissions>(
    (next, permission) => setMcpPermissionLevel(next, permission, level, cap),
    {}
  );
};

/**
 * Whether Authorized apps offers Edit for a client: it needs a grant to edit, and a cap above nothing. A
 * client capped at nothing (no consent, no `skipConsent`) has nothing Edit could give.
 */
export const canEditMcpGrant = (client: {
  permissions: TMcpGrantPermissions | null;
  cap: TMcpGrantPermissions;
}): boolean => client.permissions !== null && !isMcpGrantEmpty(client.cap);

/**
 * Per granted permission, what it needs beside itself and the grant doesn't give
 * ({@link MCP_PERMISSION_DEPENDENCIES}), for the hint next to it.
 */
export const getUnmetMcpPermissionDependencies = (
  permissions: TMcpGrantPermissions
): Partial<Record<TMcpPermission, TMcpPermissionRequirement[]>> => {
  const unmet: Partial<Record<TMcpPermission, TMcpPermissionRequirement[]>> = {};
  for (const [permission, requirements] of Object.entries(MCP_PERMISSION_DEPENDENCIES) as [
    TMcpPermission,
    readonly TMcpPermissionRequirement[],
  ][]) {
    if (levelOf(permissions, permission) === "none") continue;
    const missing = requirements.filter(
      (requirement) => RANK[levelOf(permissions, requirement.permission)] < RANK[requirement.level]
    );
    if (missing.length > 0) unmet[permission] = missing;
  }
  return unmet;
};

/** One dependency hint under a permission: what it needs, and whether the grant leaves that out. */
export type TMcpDependencyHint = { requirement: TMcpPermissionRequirement; isUnmet: boolean };

/**
 * The dependency hints the matrix shows under `permission` (spec story 16): one per permission it needs,
 * marked when the grant leaves it out. None for a Dashboard viewer, whose matrix shows only Dashboards:
 * a hint would name a permission (Feedback records) the viewer can't see or give, and their chart reads
 * go through a dashboard, which needs nothing else (ADR-0025).
 */
export const getMcpDependencyHints = (
  permission: TMcpPermission,
  permissions: TMcpGrantPermissions,
  { isDashboardViewer }: { isDashboardViewer: boolean }
): TMcpDependencyHint[] => {
  if (isDashboardViewer) return [];
  const unmet = getUnmetMcpPermissionDependencies(permissions)[permission] ?? [];
  return (MCP_PERMISSION_DEPENDENCIES[permission] ?? []).map((requirement) => ({
    requirement,
    isUnmet: unmet.includes(requirement),
  }));
};

/**
 * Whether a toggle shows the reconnect hint (spec story 14): some level it offers is disabled because the
 * client's scopes don't ask for it, which only a new consent can change.
 */
export const hasMcpCappedLevel = (options: readonly TMcpLevelOption[]): boolean =>
  options.some((option) => option.disabled);

/** Why a toggle's disabled levels can't be chosen: the user's role, or the client's scopes. */
export type TMcpCappedHint = "role" | "scopes";

/**
 * The hint a toggle shows for its disabled levels, or `null` when none is disabled. A Dashboard viewer's
 * levels are capped by the role, which can only ever give dashboard reads (ADR-0025): reconnecting the
 * client changes nothing, so the hint says it is the role rather than asking for a reconnect. Anyone
 * else's are capped by what the client's scopes ask for (spec story 14).
 */
export const getMcpCappedHint = (
  options: readonly TMcpLevelOption[],
  { isDashboardViewer }: { isDashboardViewer: boolean }
): TMcpCappedHint | null => {
  if (!hasMcpCappedLevel(options)) return null;
  return isDashboardViewer ? "role" : "scopes";
};

/**
 * What the matrix opens with: the client's existing grant when it has one (a reconnect must not undo a
 * Read-only choice), otherwise what the client asked for; either way within what it asks for now.
 */
export const getInitialMcpGrantPermissions = ({
  existing,
  cap,
}: {
  existing: TMcpGrantPermissions | null;
  cap: TMcpGrantPermissions;
}): TMcpGrantPermissions => (existing ? capMcpGrantPermissions(existing, cap) : cap);

/**
 * Authorized apps' summary of a grant (ENG-7152): one level chip per category the editor shows, `mixed`
 * where the category's permissions differ.
 */
export const getMcpGrantSummary = (
  permissions: TMcpGrantPermissions,
  { isDashboardViewer }: { isDashboardViewer: boolean }
): { category: TMcpPermissionCategory; level: TMcpCategoryLevel }[] =>
  getMcpGrantEditorCategories({ isDashboardViewer }).map(
    ({ category, permissions: categoryPermissions }) => ({
      category,
      level: getMcpCategoryLevel(permissions, categoryPermissions),
    })
  );

/** True when both give every permission at the same level, whatever order the levels were set in. */
export const isSameMcpGrant = (a: TMcpGrantPermissions, b: TMcpGrantPermissions): boolean =>
  ALL_PERMISSIONS.every((permission) => levelOf(a, permission) === levelOf(b, permission));
