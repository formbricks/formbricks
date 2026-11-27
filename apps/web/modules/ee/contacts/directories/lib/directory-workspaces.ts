import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import {
  ContactDirectoryWorkspacesInOtherDirectoryError,
  ContactDirectoryWorkspacesNotFoundError,
  ContactDirectoryWorkspacesNotMovableError,
} from "./directory-errors";

export type TClient = Prisma.TransactionClient;

export type TLockedWorkspace = { id: string; contactDirectoryId: string | null };

/**
 * Locks the organization's workspaces among `workspaceIds` (`FOR UPDATE`, in id order, so two saves never
 * wait on each other in a cycle) and returns them with the directory each uses. Ids of unknown workspaces
 * or of another organization's are simply missing from the result.
 */
export const lockWorkspaces = async (
  tx: TClient,
  organizationId: string,
  workspaceIds: string[]
): Promise<TLockedWorkspace[]> => {
  const ids = [...new Set(workspaceIds)].sort((a, b) => a.localeCompare(b));
  if (ids.length === 0) return [];
  return tx.$queryRaw<TLockedWorkspace[]>`
    SELECT "id", "contactDirectoryId" FROM "Workspace"
    WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE
  `;
};

/**
 * Moves the attribute values and survey filters of key `fromId` onto key `toId`, then deletes `fromId`.
 * A contact or survey that already has a row on `toId` keeps that row; its row on `fromId` goes.
 * Five statements per merged key, run per key by `adoptDirectorylessRows`: an N+1 kept on purpose, since
 * only keys a previous-release pod wrote during the rolling deploy are merged, and a workspace has few.
 */
const mergeAttributeKey = async (tx: TClient, fromId: string, toId: string): Promise<void> => {
  await tx.contactAttribute.deleteMany({
    where: { attributeKeyId: fromId, contact: { attributes: { some: { attributeKeyId: toId } } } },
  });
  await tx.contactAttribute.updateMany({ where: { attributeKeyId: fromId }, data: { attributeKeyId: toId } });
  await tx.surveyAttributeFilter.deleteMany({
    where: { attributeKeyId: fromId, survey: { attributeFilters: { some: { attributeKeyId: toId } } } },
  });
  await tx.surveyAttributeFilter.updateMany({
    where: { attributeKeyId: fromId },
    data: { attributeKeyId: toId },
  });
  await tx.contactAttributeKey.delete({ where: { id: fromId } });
};

/**
 * A workspace with no directory (made by a pod of the previous release during the rolling deploy) can
 * still have contacts, attribute keys and segments that pod wrote, all without a `directoryId`. Joining a
 * directory gives them that directory's id:
 * - contacts and private segments (titles are survey ids, so they can't clash) join as they are;
 * - a key joins unless the directory already has one by that name, which then takes over its attribute
 *   values and survey filters (the directory's own defaults always do: `email`, `userId`, ...);
 * - a public segment joins unless the directory already has one by that title; such a segment stays where
 *   it is, still linked to its surveys.
 * Rows that already carry a directory (a workspace removed from one keeps them there) are left alone here;
 * {@link releaseOtherDirectoryRows} handles them.
 */
const adoptDirectorylessRows = async (
  tx: TClient,
  directoryId: string,
  workspaceIds: string[]
): Promise<void> => {
  const orphan = { workspaceId: { in: workspaceIds }, directoryId: null };

  await tx.contact.updateMany({ where: orphan, data: { directoryId } });
  await tx.segment.updateMany({ where: { ...orphan, isPrivate: true }, data: { directoryId } });

  const orphanKeys = await tx.contactAttributeKey.findMany({
    where: orphan,
    select: { id: true, key: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (orphanKeys.length > 0) {
    const directoryKeys = await tx.contactAttributeKey.findMany({
      where: { directoryId, key: { in: [...new Set(orphanKeys.map(({ key }) => key))] } },
      select: { id: true, key: true },
    });
    const keyIdByName = new Map(directoryKeys.map(({ id, key }) => [key, id]));
    for (const { id, key } of orphanKeys) {
      const directoryKeyId = keyIdByName.get(key);
      if (directoryKeyId) {
        await mergeAttributeKey(tx, id, directoryKeyId);
      } else {
        await tx.contactAttributeKey.update({ where: { id }, data: { directoryId } });
        keyIdByName.set(key, id);
      }
    }
  }

  const orphanSegments = await tx.segment.findMany({
    where: { ...orphan, isPrivate: false },
    select: { id: true, title: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (orphanSegments.length > 0) {
    const taken = await tx.segment.findMany({
      where: { directoryId, title: { in: orphanSegments.map(({ title }) => title) } },
      select: { title: true },
    });
    const takenTitles = new Set(taken.map(({ title }) => title));
    const adopted = orphanSegments.filter(({ title }) => {
      if (takenTitles.has(title)) return false;
      takenTitles.add(title);
      return true;
    });
    if (adopted.length > 0) {
      await tx.segment.updateMany({
        where: { id: { in: adopted.map(({ id }) => id) } },
        data: { directoryId },
      });
    }
  }
};

/**
 * A workspace removed from a directory keeps its keys and segments there, still marked with its id. The
 * previous release's unique indexes on (`key`, `workspaceId`) and (`workspaceId`, `title`) stay until 7.0,
 * so those rows would block the workspace from creating a key or segment of the same name in its new
 * directory (a reused title, or the private segment titled with a survey's id). Joining another directory
 * therefore drops the workspace id from them: they stay in the old directory with no workspace of origin,
 * like the rows of a deleted workspace. Rejoining the same directory leaves them as they are.
 */
const releaseOtherDirectoryRows = async (
  tx: TClient,
  directoryId: string,
  workspaceIds: string[]
): Promise<void> => {
  const where = { workspaceId: { in: workspaceIds }, directoryId: { not: null }, NOT: { directoryId } };
  await tx.contactAttributeKey.updateMany({ where, data: { workspaceId: null } });
  await tx.segment.updateMany({ where, data: { workspaceId: null } });
};

/**
 * Decision 15: no merge of contacts. Directoryless workspaces may bring contacts a previous-release pod
 * wrote only into a directory with none, and only one such workspace at a time. Runs under the caller's
 * locks: the directory's row (a contact insert waits on its foreign key) and the workspaces' rows.
 */
const assertNoContactMerge = async (
  tx: TClient,
  directoryId: string,
  directorylessWorkspaceIds: string[]
): Promise<void> => {
  if (directorylessWorkspaceIds.length === 0) return;
  const found = await tx.contact.groupBy({
    by: ["workspaceId"],
    where: { workspaceId: { in: directorylessWorkspaceIds }, directoryId: null },
  });
  const withContacts = new Set(found.map(({ workspaceId }) => workspaceId));
  const bringingContacts = directorylessWorkspaceIds.filter((id) => withContacts.has(id));
  if (bringingContacts.length === 0) return;

  const merges =
    bringingContacts.length > 1 ||
    (await tx.contact.findFirst({ where: { directoryId }, select: { id: true } })) !== null;
  if (merges) throw new ContactDirectoryWorkspacesNotMovableError(bringingContacts);
};

/**
 * Adds workspaces to `directoryId` inside the caller's transaction, which already holds the directory's
 * row lock (or just created it) and the workspaces' row locks from {@link lockWorkspaces}.
 *
 * Decision 3: only a workspace with no directory joins. One in another directory is refused, never moved:
 * nothing is moved out of or deleted from any other directory. Rows a previous-release pod wrote for a
 * directoryless workspace are adopted ({@link adoptDirectorylessRows}) unless that would merge contacts,
 * and keys and segments it left in another directory lose its id ({@link releaseOtherDirectoryRows}).
 */
export const addWorkspacesToDirectory = async (
  tx: TClient,
  {
    organizationId,
    directoryId,
    workspaceIds,
    locked,
  }: { organizationId: string; directoryId: string; workspaceIds: string[]; locked: TLockedWorkspace[] }
): Promise<void> => {
  const ids = [...new Set(workspaceIds)];
  if (ids.length === 0) return;

  const missing = ids.filter((id) => !locked.some((row) => row.id === id));
  if (missing.length > 0) throw new ContactDirectoryWorkspacesNotFoundError(missing);

  const joining = locked.filter((row) => ids.includes(row.id) && row.contactDirectoryId !== directoryId);
  const elsewhere = joining.filter((row) => row.contactDirectoryId !== null).map((row) => row.id);
  if (elsewhere.length > 0) throw new ContactDirectoryWorkspacesInOtherDirectoryError(elsewhere);
  if (joining.length === 0) return;

  const joiningIds = joining.map((row) => row.id);
  await assertNoContactMerge(tx, directoryId, joiningIds);
  await tx.workspace.updateMany({
    where: { id: { in: joiningIds }, organizationId, contactDirectoryId: null },
    data: { contactDirectoryId: directoryId },
  });
  await releaseOtherDirectoryRows(tx, directoryId, joiningIds);
  await adoptDirectorylessRows(tx, directoryId, joiningIds);
};

/**
 * Decision 2: the surveys a workspace's removal cuts off. App surveys that are in progress or scheduled (a
 * paused survey with a publish date), not archived, whose segment (public or private) has at least one
 * filter. Once the workspace has no directory, identify fails, so such a survey reaches no one.
 */
export const getTargetedSurveysWhere = (workspaceIds: string[]): Prisma.SurveyWhereInput => ({
  workspaceId: { in: workspaceIds },
  type: "app",
  archivedAt: null,
  segment: { is: { NOT: { filters: { equals: [] } } } },
  OR: [{ status: "inProgress" }, { status: "paused", publishOn: { not: null } }],
});
