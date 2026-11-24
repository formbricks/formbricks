export const CONTACT_DIRECTORY_MATCHING_KEYS = ["email", "externalId"] as const;

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
  workspaces: TContactDirectoryWorkspaceRef[];
  contactCount: number;
  /**
   * Whether its workspace may move to another directory (spec decision 8): the directory has exactly one
   * workspace and holds nothing beyond its default keys. A yes/no only, so the picker leaks no counts.
   */
  workspaceCanMove: boolean;
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

/** Name and workspaces only: the matching key is fixed once the directory exists. */
export type TContactDirectoryUpdateInput = {
  name?: string;
  workspaceIds?: string[];
};
