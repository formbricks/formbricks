import type {
  ContactAttributeKeyWhereInput,
  ContactAttributeKeyWhereUniqueInput,
} from "@formbricks/database/prisma";

/**
 * The one place that says which contact attribute keys a workspace sees.
 *
 * Keys belong to the workspace's contact directory and are unique per directory (decision 12). A key's
 * own `workspaceId` only records the workspace it was created from: in a shared directory it can be
 * another workspace, and a directory's default keys have none. So nothing here filters on it.
 *
 * Use the directory builders when the directory id is at hand (`contact-directory.ts` resolves it), and
 * the workspace builders otherwise; those reach the directory through the workspace, in the same query.
 * Raw SQL that joins keys by workspace is not covered here.
 */

/** A single key, for `findUnique({ where })` and for `connect` in nested creates. */
export const uniqueAttributeKey = (
  directoryId: string,
  key: string
): ContactAttributeKeyWhereUniqueInput => ({
  directoryId_key: { directoryId, key },
});

/** A single key of the directory, as a filter. */
export const whereDirectoryAttributeKey = (
  directoryId: string,
  key: string
): ContactAttributeKeyWhereInput => ({
  key,
  directoryId,
});

/** Every key of the directory, for listing and counting. Spread it to add more conditions. */
export const whereAttributeKeysOfDirectory = (directoryId: string): ContactAttributeKeyWhereInput => ({
  directoryId,
});

const directoryOfWorkspace = (workspaceId: string): ContactAttributeKeyWhereInput["directory"] => ({
  workspaces: { some: { id: workspaceId } },
});

/** A single key of the workspace's directory, as a filter: for relation filters such as `attributeKey: whereAttributeKey(…)`. */
export const whereAttributeKey = (workspaceId: string, key: string): ContactAttributeKeyWhereInput => ({
  key,
  directory: directoryOfWorkspace(workspaceId),
});

/** Every key of the workspace's directory, for listing and counting. Spread it to add more conditions. */
export const whereAttributeKeysOfWorkspace = (workspaceId: string): ContactAttributeKeyWhereInput => ({
  directory: directoryOfWorkspace(workspaceId),
});

/** Every key of the directories of these workspaces, for listings that span the workspaces an API key can read. */
export const whereAttributeKeysOfWorkspaces = (workspaceIds: string[]): ContactAttributeKeyWhereInput => ({
  directory: { workspaces: { some: { id: { in: workspaceIds } } } },
});
