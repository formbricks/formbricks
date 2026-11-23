import type {
  ContactAttributeKeyWhereInput,
  ContactAttributeKeyWhereUniqueInput,
} from "@formbricks/database/prisma";

/**
 * The one place that says which contact attribute keys belong to a workspace.
 *
 * Every Prisma lookup, relation filter or `connect` of a key by (key, workspace) goes through these
 * builders, so moving keys from the workspace to the org-level Contact directory changes this file
 * instead of every caller. Raw SQL that joins keys by workspace is not covered here.
 */

/** A single key, for `findUnique({ where })` and for `connect` in nested creates. */
export const uniqueAttributeKey = (
  workspaceId: string,
  key: string
): ContactAttributeKeyWhereUniqueInput => ({
  key_workspaceId: { key, workspaceId },
});

/** A single key, as a filter: for relation filters such as `attributeKey: whereAttributeKey(…)`. */
export const whereAttributeKey = (workspaceId: string, key: string): ContactAttributeKeyWhereInput => ({
  key,
  workspaceId,
});

/** Every key of a workspace, for listing and counting. Spread it to add more conditions. */
export const whereAttributeKeysOfWorkspace = (workspaceId: string): ContactAttributeKeyWhereInput => ({
  workspaceId,
});

/** Every key of any of these workspaces, for listings that span the workspaces an API key can read. */
export const whereAttributeKeysOfWorkspaces = (workspaceIds: string[]): ContactAttributeKeyWhereInput => ({
  workspaceId: { in: workspaceIds },
});
