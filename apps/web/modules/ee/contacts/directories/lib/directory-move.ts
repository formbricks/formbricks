import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import type { TContactDirectoryMatchingKey } from "../types";
import {
  BASE_DEFAULT_ATTRIBUTE_KEY_NAMES,
  EXTERNAL_ID_ATTRIBUTE_KEY_NAME,
  getDefaultAttributeKeys,
} from "./constants";
import {
  ContactDirectoryWorkspacesNotFoundError,
  ContactDirectoryWorkspacesNotMovableError,
} from "./directory-errors";
import { collectAttributeKeysFromSegmentFilters } from "./segment-filter-keys";

export type TClient = Prisma.TransactionClient;

export type TDirectoryContents = {
  workspaceCount: number;
  contactCount: number;
  publicSegmentCount: number;
  blockingKeyCount: number;
};

const countsById = <T extends { _count: { _all: number } }>(
  rows: T[],
  getId: (row: T) => string | null
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = getId(row);
    if (id) counts.set(id, row._count._all);
  }
  return counts;
};

/**
 * Contacts per directory. The settings list shows the number: one grouped count over the page's directories
 * on the indexed `Contact.directoryId` (to check at production size, where a directory can hold millions).
 * The move only needs to know whether there are any, so it reads one row per directory (`exists`, counted
 * as 1) instead of counting them under its lock.
 */
const tallyContacts = async (
  client: TClient,
  directoryIds: string[],
  mode: "count" | "exists"
): Promise<Map<string, number>> => {
  if (mode === "exists") {
    const found = await Promise.all(
      directoryIds.map((directoryId) =>
        client.contact.findFirst({ where: { directoryId }, select: { id: true } })
      )
    );
    return new Map(directoryIds.filter((_, index) => found[index] !== null).map((id) => [id, 1]));
  }
  const groups = await client.contact.groupBy({
    by: ["directoryId"],
    where: { directoryId: { in: directoryIds } },
    _count: { _all: true },
  });
  return countsById(groups, (row) => row.directoryId);
};

/** What each directory holds: grouped counts per kind, and contacts as `tallyContacts` reads them. */
export const getDirectoryContents = async (
  client: TClient,
  directoryIds: string[],
  contactTally: "count" | "exists" = "count"
): Promise<Map<string, TDirectoryContents>> => {
  const [workspaceGroups, contacts, segmentGroups, keyGroups] = await Promise.all([
    client.workspace.groupBy({
      by: ["contactDirectoryId"],
      where: { contactDirectoryId: { in: directoryIds } },
      _count: { _all: true },
    }),
    tallyContacts(client, directoryIds, contactTally),
    // Private segments are surveys' own filters: they move with the workspace instead of blocking it.
    client.segment.groupBy({
      by: ["directoryId"],
      where: { directoryId: { in: directoryIds }, isPrivate: false },
      _count: { _all: true },
    }),
    // Keys that stop a workspace leaving: a key beyond the defaults (`externalId` is a default only in an
    // external-ID directory), or any key a survey attribute filter uses.
    client.contactAttributeKey.groupBy({
      by: ["directoryId"],
      where: {
        directoryId: { in: directoryIds },
        OR: [
          { key: { notIn: [...BASE_DEFAULT_ATTRIBUTE_KEY_NAMES, EXTERNAL_ID_ATTRIBUTE_KEY_NAME] } },
          { key: EXTERNAL_ID_ATTRIBUTE_KEY_NAME, directory: { matchingKey: "email" } },
          { attributeFilters: { some: {} } },
        ],
      },
      _count: { _all: true },
    }),
  ]);

  const workspaces = countsById(workspaceGroups, (row) => row.contactDirectoryId);
  const segments = countsById(segmentGroups, (row) => row.directoryId);
  const keys = countsById(keyGroups, (row) => row.directoryId);

  return new Map(
    directoryIds.map((id) => [
      id,
      {
        workspaceCount: workspaces.get(id) ?? 0,
        contactCount: contacts.get(id) ?? 0,
        publicSegmentCount: segments.get(id) ?? 0,
        blockingKeyCount: keys.get(id) ?? 0,
      },
    ])
  );
};

/**
 * The attribute keys of `targetDirectoryId` among `keys`, or, with no target (the settings list, which
 * cannot know where a workspace will go), the defaults every directory of that matching key has.
 */
const getKeysKeptIn = async (
  client: TClient,
  targetDirectoryId: string | undefined,
  matchingKey: TContactDirectoryMatchingKey,
  keys: string[]
): Promise<Set<string>> => {
  if (!targetDirectoryId) return new Set(getDefaultAttributeKeys(matchingKey).map(({ key }) => key));
  const kept = await client.contactAttributeKey.findMany({
    where: { directoryId: targetDirectoryId, key: { in: keys } },
    select: { key: true },
  });
  return new Set(kept.map(({ key }) => key));
};

/**
 * Spec decision 8: a workspace may leave its directory only if it is the directory's one workspace and the
 * directory holds no contacts, no public segments, no keys beyond the defaults and no survey filter on
 * such a key. Directories that pass the counts get their surveys' private segments read, to look for
 * filters naming a key the new directory won't have: the target directory's keys when the move names it
 * (an `externalId` filter can't go into an email directory), else the leaving directory's own defaults.
 * Returns the ids of the directories that may be left.
 */
export const getLeavableDirectoryIds = async (
  client: TClient,
  directories: { id: string; matchingKey: TContactDirectoryMatchingKey }[],
  contents: Map<string, TDirectoryContents>,
  targetDirectoryId?: string
): Promise<Set<string>> => {
  const candidates = directories.filter(({ id }) => {
    const c = contents.get(id);
    return (
      c?.workspaceCount === 1 &&
      c.contactCount === 0 &&
      c.publicSegmentCount === 0 &&
      c.blockingKeyCount === 0
    );
  });
  if (candidates.length === 0) return new Set();

  const privateSegments = await client.segment.findMany({
    where: { directoryId: { in: candidates.map(({ id }) => id) }, isPrivate: true },
    select: { directoryId: true, filters: true },
  });

  const blocked = new Set<string>();
  for (const { directoryId, filters } of privateSegments) {
    const directory = candidates.find(({ id }) => id === directoryId);
    if (!directory) continue;
    const keys = collectAttributeKeysFromSegmentFilters(filters);
    if (keys.length === 0) continue;
    // Sequential on purpose: inside the move's transaction, and only for segments that filter on keys.
    const kept = await getKeysKeptIn(client, targetDirectoryId, directory.matchingKey, keys); // NOSONAR
    if (keys.some((key) => !kept.has(key))) blocked.add(directory.id);
  }

  return new Set(candidates.map(({ id }) => id).filter((id) => !blocked.has(id)));
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
 * Spec decision 8: a workspace with no directory (made by a pod of the previous release during the rolling
 * deploy) can still have contacts, attribute keys and segments that pod wrote, all without a
 * `directoryId`. Getting its first directory gives them that directory's id:
 * - contacts and private segments (titles are survey ids, so they can't clash) join as they are;
 * - a key joins unless the directory already has one by that name, which then takes over its attribute
 *   values and survey filters (the directory's own defaults always do: `email`, `userId`, ...);
 * - a public segment joins unless the directory already has one by that title; such a segment stays where
 *   it is, still linked to its surveys.
 * Runs under the workspace locks of the move. A previous-release pod that writes for the workspace while
 * the move runs can still leave a row behind.
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
 * Decision 15: no merge of contacts in this release. Directoryless workspaces may bring their contacts
 * only into a directory with none, and only one such workspace at a time. Runs under the move's locks:
 * the target directory's row (an insert waits on its foreign key) and the workspaces' rows.
 */
const assertNoContactMerge = async (
  tx: TClient,
  directoryId: string,
  directorylessWorkspaceIds: string[]
): Promise<void> => {
  const found = await Promise.all(
    directorylessWorkspaceIds.map((workspaceId) =>
      tx.contact.findFirst({ where: { workspaceId, directoryId: null }, select: { id: true } })
    )
  );
  const bringingContacts = directorylessWorkspaceIds.filter((_, index) => found[index] !== null);
  if (bringingContacts.length === 0) return;

  const merges =
    bringingContacts.length > 1 ||
    (await tx.contact.findFirst({ where: { directoryId }, select: { id: true } })) !== null;
  if (merges) throw new ContactDirectoryWorkspacesNotMovableError(bringingContacts);
};

/**
 * Moves workspaces into `directoryId` under spec decision 8, inside the caller's transaction.
 *
 * Locks the workspaces, then their current directories (`FOR UPDATE`, in id order), and only then reads
 * what those directories hold. A contact insert into a locked directory waits on its foreign key until this
 * transaction ends, so a contact that arrived before the lock is counted and refuses the move, and one that
 * arrives after it fails against the deleted directory instead of landing in it. Then, in order: the
 * workspaces point at the new directory, the surveys' private segments follow them (the old directory's
 * cascade would otherwise delete them and the surveys would lose their targeting; their titles are survey
 * ids, so they can't clash), and the old, now unused directories go, taking their default keys.
 *
 * A workspace with no directory has none to delete; the rows it has anyway are adopted
 * ({@link adoptDirectorylessRows}), unless that would merge contacts ({@link assertNoContactMerge}).
 */
export const moveWorkspacesIntoDirectory = async (
  tx: TClient,
  {
    organizationId,
    directoryId,
    workspaceIds,
  }: { organizationId: string; directoryId: string; workspaceIds: string[] }
): Promise<void> => {
  const ids = [...new Set(workspaceIds)].sort();
  if (ids.length === 0) return;

  const locked = await tx.$queryRaw<{ id: string; contactDirectoryId: string | null }[]>`
    SELECT "id", "contactDirectoryId" FROM "Workspace"
    WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE
  `;
  const missing = ids.filter((id) => !locked.some((row) => row.id === id));
  if (missing.length > 0) throw new ContactDirectoryWorkspacesNotFoundError(missing);

  const moving = locked.filter((row) => row.contactDirectoryId !== directoryId);
  if (moving.length === 0) return;

  const oldDirectoryIds = [
    ...new Set(moving.map((row) => row.contactDirectoryId).filter((id): id is string => id !== null)),
  ].sort();
  const directorylessWorkspaceIds = moving
    .filter((row) => row.contactDirectoryId === null)
    .map((row) => row.id);

  if (oldDirectoryIds.length > 0) {
    const oldDirectories = await tx.$queryRaw<{ id: string; matchingKey: TContactDirectoryMatchingKey }[]>`
      SELECT "id", "matchingKey" FROM "ContactDirectory"
      WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(oldDirectoryIds)})
      ORDER BY "id"
      FOR UPDATE
    `;
    const contents = await getDirectoryContents(tx, oldDirectoryIds, "exists");
    const leavable = await getLeavableDirectoryIds(tx, oldDirectories, contents, directoryId);

    const notMovable = moving
      .filter((row) => row.contactDirectoryId !== null && !leavable.has(row.contactDirectoryId))
      .map((row) => row.id);
    if (notMovable.length > 0) throw new ContactDirectoryWorkspacesNotMovableError(notMovable);
  }
  if (directorylessWorkspaceIds.length > 0) {
    await assertNoContactMerge(tx, directoryId, directorylessWorkspaceIds);
  }

  await tx.workspace.updateMany({
    where: { id: { in: moving.map((row) => row.id) }, organizationId },
    data: { contactDirectoryId: directoryId },
  });

  if (oldDirectoryIds.length > 0) {
    await tx.segment.updateMany({
      where: { directoryId: { in: oldDirectoryIds }, isPrivate: true },
      data: { directoryId },
    });
  }
  if (directorylessWorkspaceIds.length > 0) {
    await adoptDirectorylessRows(tx, directoryId, directorylessWorkspaceIds);
  }
  if (oldDirectoryIds.length > 0) {
    await tx.contactDirectory.deleteMany({ where: { id: { in: oldDirectoryIds }, organizationId } });
  }
};
