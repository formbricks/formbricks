import type { TMcpGrantAccess, TMcpGrantAccessSelection } from "./grant";

/**
 * The organization & workspace access half of the grant editor (GLOSSARY.md "Organization & workspace
 * access", ENG-7153), shared by the consent screen and Authorized apps' Edit. Pure, so the editor's rules
 * are unit-tested here rather than through a component.
 *
 * The draft keeps both pick lists, so switching between Only selected organizations and Only selected
 * workspaces and back does not lose what was picked; only the chosen mode's picks are saved.
 */

export type TMcpGrantAccessDraft = {
  access: TMcpGrantAccess;
  organizationIds: string[];
  workspaceIds: string[];
};

/** What the access picker offers: the user's organizations, and their workspaces across them. */
export type TMcpGrantAccessOptions = {
  organizations: { id: string; name: string }[];
  workspaces: { id: string; name: string; organizationId: string; organizationName: string }[];
};

type TTranslate = (key: string, values?: Record<string, string>) => string;

/**
 * The ids `selection` picks, as two lists: the organizations of Only selected organizations, the
 * workspaces of Only selected workspaces, and nothing else. For what keeps both lists side by side (the
 * draft, the selection rows); everything else reads the selection itself.
 */
export const getMcpGrantSelectedIds = (
  selection: TMcpGrantAccessSelection
): { organizationIds: string[]; workspaceIds: string[] } => ({
  organizationIds: selection.access === "organizations" ? [...selection.organizationIds] : [],
  workspaceIds: selection.access === "workspaces" ? [...selection.workspaceIds] : [],
});

/**
 * `selection` without what `options` no longer offers the user (spec story 36): a workspace they lost
 * access to, or an organization they now hold only as a billing member. What Authorized apps counts and
 * Edit and the consent screen open with, so neither shows an id the picker hides. The stored rows are
 * left alone until the next save drops them (`resolveMcpGrantSelection`).
 */
export const limitMcpGrantAccessToOptions = (
  selection: TMcpGrantAccessSelection,
  options: TMcpGrantAccessOptions
): TMcpGrantAccessSelection => {
  switch (selection.access) {
    case "all":
      return selection;
    case "organizations": {
      const offered = new Set(options.organizations.map(({ id }) => id));
      return {
        access: "organizations",
        organizationIds: selection.organizationIds.filter((id) => offered.has(id)),
      };
    }
    case "workspaces": {
      const offered = new Set(options.workspaces.map(({ id }) => id));
      return { access: "workspaces", workspaceIds: selection.workspaceIds.filter((id) => offered.has(id)) };
    }
  }
};

/** What the editor opens with: the grant's own access, or All access for a client with none yet. */
export const initialMcpGrantAccessDraft = (stored: TMcpGrantAccessSelection | null): TMcpGrantAccessDraft =>
  stored
    ? { access: stored.access, ...getMcpGrantSelectedIds(stored) }
    : { access: "all", organizationIds: [], workspaceIds: [] };

/**
 * The access the draft saves, or `null` when it can't be saved: a selection with nothing picked gives
 * the client nothing, so Allow and Save stay disabled (a grant that loses its last workspace later is a
 * different case: it stays, and Authorized apps shows "No workspaces").
 */
export const toMcpGrantAccessSelection = (draft: TMcpGrantAccessDraft): TMcpGrantAccessSelection | null => {
  switch (draft.access) {
    case "all":
      return { access: "all" };
    case "organizations":
      return draft.organizationIds.length > 0
        ? { access: "organizations", organizationIds: draft.organizationIds }
        : null;
    case "workspaces":
      return draft.workspaceIds.length > 0
        ? { access: "workspaces", workspaceIds: draft.workspaceIds }
        : null;
  }
};

/** The fields a request carries for an access: `access`, and the matching ids for a selection. */
export const toMcpGrantAccessRequest = (
  selection: TMcpGrantAccessSelection
): { access: TMcpGrantAccess; organizationIds?: string[]; workspaceIds?: string[] } => selection;

const sameIds = (a: readonly string[], b: readonly string[]): boolean => {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...right].every((id) => left.has(id));
};

/** True when `selection` saves exactly what the grant already has, so Edit has nothing to save. */
export const isSameMcpGrantAccess = (
  selection: TMcpGrantAccessSelection,
  saved: TMcpGrantAccessSelection
): boolean => {
  const picked = getMcpGrantSelectedIds(selection);
  const kept = getMcpGrantSelectedIds(saved);
  return (
    selection.access === saved.access &&
    sameIds(picked.organizationIds, kept.organizationIds) &&
    sameIds(picked.workspaceIds, kept.workspaceIds)
  );
};

/**
 * "All access", "2 organizations", "3 workspaces", or "No workspaces" for a selection left with nothing
 * (its workspaces or organizations were deleted, or the user lost them): the grant stays listed so the
 * user can edit or revoke it.
 */
export const getMcpGrantAccessSummary = (grant: TMcpGrantAccessSelection, t: TTranslate): string => {
  switch (grant.access) {
    case "all":
      return t("auth.oauth.access.summary_all");
    case "organizations": {
      const organizations = grant.organizationIds.length;
      if (organizations === 0) return t("auth.oauth.access.summary_none");
      return organizations === 1
        ? t("auth.oauth.access.summary_one_organization")
        : t("auth.oauth.access.summary_organizations", { count: String(organizations) });
    }
    case "workspaces": {
      const workspaces = grant.workspaceIds.length;
      if (workspaces === 0) return t("auth.oauth.access.summary_none");
      return workspaces === 1
        ? t("auth.oauth.access.summary_one_workspace")
        : t("auth.oauth.access.summary_workspaces", { count: String(workspaces) });
    }
  }
};
