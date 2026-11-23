import "server-only";
import { can } from "@/lib/authorization";
import type { TAuthorizationAction } from "@/lib/authorization/contract";
import { getWorkspacesOnDirectory } from "@/modules/ee/contacts/lib/contact-directory";

type TWorkspaceAction = Extract<TAuthorizationAction, `workspace.${string}`>;

/**
 * For management routes addressed by a contact or attribute key id. The row's own `workspaceId` only
 * records where it was created, so access goes through its contact directory (decision 7): the key may
 * act on the row when it may act on one of its workspaces that uses that directory. Returns that
 * workspace (lowest id first), or null when the key reaches none.
 */
export const findApiKeyWorkspaceOnDirectory = async (
  apiKeyId: string,
  action: TWorkspaceAction,
  directoryId: string | null,
  workspaceIds: readonly string[]
): Promise<string | null> => {
  if (!directoryId) return null;

  for (const workspaceId of await getWorkspacesOnDirectory(directoryId, workspaceIds)) {
    // Usually one workspace: a key rarely holds two workspaces of one directory.
    if (await can({ type: "apiKey", id: apiKeyId }, action, { type: "workspace", id: workspaceId })) {
      return workspaceId;
    }
  }
  return null;
};
