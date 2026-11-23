import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import type { ContactDirectoryMatchingKey, ContactWhereInput } from "@formbricks/database/prisma";

/** The message every contact API and `setUserId` answers with when the workspace has no directory. */
export const CONTACT_DIRECTORY_MISSING_MESSAGE =
  "A contact directory needs to be set up for this workspace before contacts are available. Ask an organization owner or manager to assign one.";

/**
 * The workspace has no contact directory (a new workspace, or one a 6.2 pod made during the rollout), so
 * no contact can be read or written for it. A 403: the request is fine, the workspace is not set up.
 * Its name is in `EXPECTED_ERROR_NAMES`, so the shared API error boundaries surface its message.
 */
export class ContactDirectoryMissingError extends Error {
  readonly statusCode = 403;

  constructor() {
    super(CONTACT_DIRECTORY_MISSING_MESSAGE);
    this.name = "ContactDirectoryMissingError";
  }
}

export type TWorkspaceContactDirectory = {
  id: string;
  matchingKey: ContactDirectoryMatchingKey;
};

/**
 * The contact directory a workspace uses, or null when it has none.
 *
 * Deduped per request only. Do not put it behind the shared cache: moving a workspace to another
 * directory deletes the old one, and a stale id would write contacts into a deleted directory.
 */
export const getWorkspaceContactDirectory = reactCache(
  async (workspaceId: string): Promise<TWorkspaceContactDirectory | null> => {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { contactDirectory: { select: { id: true, matchingKey: true } } },
    });
    return workspace?.contactDirectory ?? null;
  }
);

/** The workspace's contact directory; throws {@link ContactDirectoryMissingError} when it has none. */
export const requireWorkspaceContactDirectory = async (
  workspaceId: string
): Promise<TWorkspaceContactDirectory> => {
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (!directory) throw new ContactDirectoryMissingError();
  return directory;
};

/**
 * The contacts a workspace sees: every contact of its directory, in the same query. A contact's own
 * `workspaceId` only records where it was created, so never filter contacts on it. Matches nothing for
 * a workspace with no directory. Spread it to add more conditions, in `findUnique` too.
 */
export const whereContactsOfWorkspace = (workspaceId: string): Pick<ContactWhereInput, "directory"> => ({
  directory: { workspaces: { some: { id: workspaceId } } },
});

/**
 * For listings that span the workspaces an API key can read: each contact directory those workspaces
 * use, mapped to the one workspace a row of that directory is reported under. Two of the key's
 * workspaces on one directory see the same rows, so each row is listed once, under the workspace with
 * the lowest id (deterministic, whatever order the key's permissions arrive in).
 */
export const getReportingWorkspaceByDirectory = async (
  workspaceIds: readonly string[]
): Promise<Map<string, string>> => {
  if (workspaceIds.length === 0) return new Map();

  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: [...workspaceIds] }, contactDirectoryId: { not: null } },
    select: { id: true, contactDirectoryId: true },
    orderBy: { id: "asc" },
  });

  const byDirectory = new Map<string, string>();
  for (const workspace of workspaces) {
    if (workspace.contactDirectoryId && !byDirectory.has(workspace.contactDirectoryId)) {
      byDirectory.set(workspace.contactDirectoryId, workspace.id);
    }
  }
  return byDirectory;
};

/**
 * The workspaces among `workspaceIds` that use `directoryId`, lowest id first. For routes addressed by a
 * contact or key id: the caller may reach the row through any of its workspaces on the row's directory.
 */
export const getWorkspacesOnDirectory = async (
  directoryId: string,
  workspaceIds: readonly string[]
): Promise<string[]> => {
  if (workspaceIds.length === 0) return [];

  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: [...workspaceIds] }, contactDirectoryId: directoryId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return workspaces.map((workspace) => workspace.id);
};
