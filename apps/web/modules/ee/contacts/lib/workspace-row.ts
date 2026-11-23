import { ResourceNotFoundError } from "@formbricks/types/errors";

/**
 * Contacts, attribute keys and segments belong to a contact directory now (ENG-7491), and their
 * `workspaceId` only records the workspace the row was created from. It becomes NULL when that workspace is
 * deleted while the directory lives on in other workspaces. The app still reads these rows by workspace and
 * types them with one, so until those reads move to the directory, a row without a workspace counts as not
 * found.
 */
export const hasWorkspace = <T extends { workspaceId: string | null }>(
  row: T
): row is T & { workspaceId: string } => row.workspaceId !== null;

export const requireWorkspace = <T extends { id: string; workspaceId: string | null }>(
  row: T,
  resource: string
): T & { workspaceId: string } => {
  if (!hasWorkspace(row)) throw new ResourceNotFoundError(resource, row.id);
  return row;
};
