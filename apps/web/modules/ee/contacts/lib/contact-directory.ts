import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import type { ContactDirectoryMatchingKey, ContactWhereInput, Prisma } from "@formbricks/database/prisma";

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
 * Deduped per request only. Do not put it behind the shared cache: a workspace can be removed from its
 * directory at any time, and a stale id would write contacts into a directory it no longer uses.
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

/** The id of the workspace's contact directory, or null when it has none. */
export const getWorkspaceContactDirectoryId = async (workspaceId: string): Promise<string | null> =>
  (await getWorkspaceContactDirectory(workspaceId))?.id ?? null;

/** The workspace's contact directory; throws {@link ContactDirectoryMissingError} when it has none. */
export const requireWorkspaceContactDirectory = async (
  workspaceId: string
): Promise<TWorkspaceContactDirectory> => {
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (!directory) throw new ContactDirectoryMissingError();
  return directory;
};

/**
 * The workspace's directory, read in `tx` with the workspace's row held `FOR SHARE` until `tx` ends.
 * Removing the workspace from a directory takes the same row `FOR UPDATE`, so it waits for `tx`, or `tx`
 * sees the workspace already gone: a write in `tx` never lands in a directory the workspace has left.
 *
 * A directory save locks the directory row, then the workspace rows; a write into the directory takes a
 * key-share lock on the directory row through its foreign key. So the directory row is locked here first,
 * in the save's order, and the workspace row second: taking them the other way round can deadlock with a
 * save. The directory is read once before the locks to know which row to lock, and again after: if it
 * changed meanwhile, the workspace is read as having no directory.
 */
export const lockWorkspaceDirectory = async (
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<TWorkspaceContactDirectory | null> => {
  const readDirectory = async () =>
    (
      await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { contactDirectory: { select: { id: true, matchingKey: true } } },
      })
    )?.contactDirectory ?? null;

  const before = await readDirectory();
  if (!before) return null;
  await tx.$executeRaw`SELECT 1 FROM "ContactDirectory" WHERE "id" = ${before.id} FOR KEY SHARE`;
  await tx.$executeRaw`SELECT 1 FROM "Workspace" WHERE "id" = ${workspaceId} FOR SHARE`;
  // Read after the locks, so it sees the directory a save that held them committed.
  const after = await readDirectory();
  return after?.id === before.id ? after : null;
};

/**
 * Runs `write` in a transaction that holds the workspace's directory with {@link lockWorkspaceDirectory}.
 * Throws {@link ContactDirectoryMissingError} when the workspace has no directory, or when
 * `expectedDirectoryId` (one the caller read earlier) is no longer its directory. `timeout` raises the
 * transaction's time limit for a write that does more than a few statements.
 */
export const withWorkspaceDirectory = async <T>(
  workspaceId: string,
  write: (tx: Prisma.TransactionClient, directory: TWorkspaceContactDirectory) => Promise<T>,
  { expectedDirectoryId, timeout }: { expectedDirectoryId?: string; timeout?: number } = {}
): Promise<T> =>
  prisma.$transaction(
    async (tx) => {
      const directory = await lockWorkspaceDirectory(tx, workspaceId);
      if (!directory || (expectedDirectoryId !== undefined && directory.id !== expectedDirectoryId)) {
        throw new ContactDirectoryMissingError();
      }
      return write(tx, directory);
    },
    timeout === undefined ? undefined : { timeout }
  );

/**
 * The contacts a workspace sees: every contact of its directory, in the same query. A contact's own
 * `workspaceId` only records where it was created, so never filter contacts on it. Matches nothing for
 * a workspace with no directory. Spread it to add more conditions, in `findUnique` too.
 */
export const whereContactsOfWorkspace = (workspaceId: string): Pick<ContactWhereInput, "directory"> => ({
  directory: { workspaces: { some: { id: workspaceId } } },
});

/**
 * The workspace a contact read through `callerWorkspaceId` reports. A contact's `workspaceId` records the
 * workspace it was created from, and is null once that workspace is deleted while the directory lives
 * on; the read then reports the caller's workspace, so `TContact.workspaceId` stays non-null.
 *
 * Contacts keep their creating workspace; attribute keys always report the caller's
 * (`withCallerWorkspace`), because a directory's default keys were never created from a workspace.
 */
export const withCreatingOrCallerWorkspace = <T extends { workspaceId: string | null }>(
  contact: T,
  callerWorkspaceId: string
): T & { workspaceId: string } => ({ ...contact, workspaceId: contact.workspaceId ?? callerWorkspaceId });

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
