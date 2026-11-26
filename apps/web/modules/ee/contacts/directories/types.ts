export const CONTACT_DIRECTORY_MATCHING_KEYS = ["email", "userId"] as const;

export type TContactDirectoryMatchingKey = (typeof CONTACT_DIRECTORY_MATCHING_KEYS)[number];

export type TContactDirectoryWorkspaceRef = {
  id: string;
  name: string;
};

/** A contact directory as `/api/internal/contact-directories` returns it. */
export type TContactDirectory = {
  id: string;
  name: string;
  matchingKey: TContactDirectoryMatchingKey;
  /** An archived directory has no workspaces (ADR 0062); it is never offered in a workspace picker. */
  isArchived: boolean;
  workspaces: TContactDirectoryWorkspaceRef[];
  contactCount: number;
};

/** One organization workspace and the directory it uses, if any. */
export type TContactDirectoryWorkspace = TContactDirectoryWorkspaceRef & {
  directoryId: string | null;
};

/** `GET /api/internal/contact-directories`: the list page and the workspace picker read the same document. */
export type TContactDirectoryList = {
  directories: TContactDirectory[];
  workspaces: TContactDirectoryWorkspace[];
};

export type TContactDirectoryCreateInput = {
  name: string;
  matchingKey: TContactDirectoryMatchingKey;
  workspaceIds: string[];
};

/**
 * Name, workspaces and archive state: the matching key is fixed once the directory exists. `workspaceIds`
 * is the full list, so leaving a workspace out removes it. `pauseSurveysInWorkspaceIds` names removed
 * workspaces whose targeted surveys are paused in the same save.
 */
export type TContactDirectoryUpdateInput = {
  name?: string;
  workspaceIds?: string[];
  isArchived?: boolean;
  pauseSurveysInWorkspaceIds?: string[];
};

/** "scheduled" is a paused survey with a publish date, as the survey list labels it. */
export type TContactDirectoryTargetedSurveyStatus = "inProgress" | "scheduled";

/** A running app survey whose segment has at least one filter: it stops reaching anyone on removal. */
export type TContactDirectoryTargetedSurvey = {
  id: string;
  name: string;
  status: TContactDirectoryTargetedSurveyStatus;
};

/**
 * `GET /api/internal/contact-directories/{directoryId}/targeted-surveys`: one entry per workspace, with at
 * most `CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT` surveys and the count of all of them.
 */
export type TContactDirectoryTargetedSurveys = {
  workspaces: { workspaceId: string; surveys: TContactDirectoryTargetedSurvey[]; totalCount: number }[];
};
