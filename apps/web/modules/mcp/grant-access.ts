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

/** A saved grant's access, as Authorized apps lists it (the picks of its own mode only). */
export type TMcpStoredGrantAccess = TMcpGrantAccessDraft;

type TTranslate = (key: string, values?: Record<string, string>) => string;

/** What the editor opens with: the grant's own access, or All access for a client with none yet. */
export const initialMcpGrantAccessDraft = (stored: TMcpStoredGrantAccess | null): TMcpGrantAccessDraft =>
  stored
    ? {
        access: stored.access,
        organizationIds: [...stored.organizationIds],
        workspaceIds: [...stored.workspaceIds],
      }
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

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");

/** True when `selection` saves exactly what the grant already has, so Edit has nothing to save. */
export const isSameMcpGrantAccess = (
  selection: TMcpGrantAccessSelection,
  saved: TMcpStoredGrantAccess
): boolean => {
  if (selection.access !== saved.access) return false;
  switch (selection.access) {
    case "all":
      return true;
    case "organizations":
      return sameIds(selection.organizationIds, saved.organizationIds);
    case "workspaces":
      return sameIds(selection.workspaceIds, saved.workspaceIds);
  }
};

/**
 * "All access", "2 organizations", "3 workspaces", or "No workspaces" for a selection left with nothing
 * (its workspaces or organizations were deleted, or the user lost them): the grant stays listed so the
 * user can edit or revoke it.
 */
export const getMcpGrantAccessSummary = (grant: TMcpStoredGrantAccess, t: TTranslate): string => {
  const organizations = grant.organizationIds.length;
  const workspaces = grant.workspaceIds.length;
  switch (grant.access) {
    case "all":
      return t("auth.oauth.access.summary_all");
    case "organizations":
      if (organizations === 0) return t("auth.oauth.access.summary_none");
      return organizations === 1
        ? t("auth.oauth.access.summary_one_organization")
        : t("auth.oauth.access.summary_organizations", { count: String(organizations) });
    case "workspaces":
      if (workspaces === 0) return t("auth.oauth.access.summary_none");
      return workspaces === 1
        ? t("auth.oauth.access.summary_one_workspace")
        : t("auth.oauth.access.summary_workspaces", { count: String(workspaces) });
  }
};
