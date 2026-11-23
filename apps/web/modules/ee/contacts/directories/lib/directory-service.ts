import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { isUniqueConstraintError, retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import type {
  TContactDirectory,
  TContactDirectoryList,
  TContactDirectoryMatchingKey,
  TContactDirectoryWorkspaceRef,
} from "../types";
import {
  BASE_DEFAULT_ATTRIBUTE_KEY_NAMES,
  CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES,
  EXTERNAL_ID_ATTRIBUTE_KEY_NAME,
  getDefaultAttributeKeys,
} from "./constants";
import { collectAttributeKeysFromSegmentFilters } from "./segment-filter-keys";

export class ContactDirectoryNotFoundError extends Error {
  constructor() {
    super("Contact directory not found");
    this.name = "ContactDirectoryNotFoundError";
  }
}

export class ContactDirectoryNameTakenError extends Error {
  constructor() {
    super("A contact directory with this name already exists in the organization");
    this.name = "ContactDirectoryNameTakenError";
  }
}

export class ContactDirectoryNameRequiredError extends Error {
  constructor() {
    super("A contact directory used by two or more workspaces needs a name");
    this.name = "ContactDirectoryNameRequiredError";
  }
}

/** Carries the workspace ids the request named, so the route can point at them. */
abstract class ContactDirectoryWorkspacesError extends Error {
  readonly workspaceIds: string[];

  constructor(message: string, workspaceIds: string[]) {
    super(message);
    this.workspaceIds = workspaceIds;
  }
}

/** Unknown ids and ids of another organization's workspaces, which must look the same. */
export class ContactDirectoryWorkspacesNotFoundError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("Some workspaces were not found in the organization", workspaceIds);
    this.name = "ContactDirectoryWorkspacesNotFoundError";
  }
}

export class ContactDirectoryWorkspacesNotMovableError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("Some workspaces can't move to another contact directory", workspaceIds);
    this.name = "ContactDirectoryWorkspacesNotMovableError";
  }
}

export class ContactDirectoryWorkspacesCannotLeaveError extends ContactDirectoryWorkspacesError {
  constructor(workspaceIds: string[]) {
    super("A workspace can't leave its contact directory", workspaceIds);
    this.name = "ContactDirectoryWorkspacesCannotLeaveError";
  }
}

type TClient = Prisma.TransactionClient;

type TDirectoryContents = {
  workspaceCount: number;
  contactCount: number;
  publicSegmentCount: number;
  blockingKeyCount: number;
};

/** Trims a name; an empty one means "no name" (spec decision 2). */
const normalizeName = (name: string | null | undefined): string | null => {
  const trimmed = name?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
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

/** What each directory holds, in four grouped queries however many directories there are. */
const getDirectoryContents = async (
  client: TClient,
  directoryIds: string[]
): Promise<Map<string, TDirectoryContents>> => {
  const [workspaceGroups, contactGroups, segmentGroups, keyGroups] = await Promise.all([
    client.workspace.groupBy({
      by: ["contactDirectoryId"],
      where: { contactDirectoryId: { in: directoryIds } },
      _count: { _all: true },
    }),
    client.contact.groupBy({
      by: ["directoryId"],
      where: { directoryId: { in: directoryIds } },
      _count: { _all: true },
    }),
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
  const contacts = countsById(contactGroups, (row) => row.directoryId);
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
const getLeavableDirectoryIds = async (
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

const toContactDirectory = (
  directory: { id: string; name: string | null; matchingKey: TContactDirectoryMatchingKey },
  workspaces: TContactDirectoryWorkspaceRef[],
  contents: TDirectoryContents | undefined,
  leavable: Set<string>
): TContactDirectory => ({
  id: directory.id,
  name: directory.name,
  matchingKey: directory.matchingKey,
  workspaces,
  contactCount: contents?.contactCount ?? 0,
  workspaceCanMove: leavable.has(directory.id),
});

/** Every directory of the organization, and every workspace with the directory it uses. */
export const listContactDirectories = async (organizationId: string): Promise<TContactDirectoryList> => {
  const [directories, workspaces] = await Promise.all([
    prisma.contactDirectory.findMany({
      where: { organizationId },
      select: { id: true, name: true, matchingKey: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspace.findMany({
      where: { organizationId },
      select: { id: true, name: true, contactDirectoryId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const contents = await getDirectoryContents(
    prisma,
    directories.map(({ id }) => id)
  );
  const leavable = await getLeavableDirectoryIds(prisma, directories, contents);

  return {
    directories: directories.map((directory) =>
      toContactDirectory(
        directory,
        workspaces
          .filter((workspace) => workspace.contactDirectoryId === directory.id)
          .map(({ id, name }) => ({ id, name })),
        contents.get(directory.id),
        leavable
      )
    ),
    workspaces: workspaces.map(({ id, name, contactDirectoryId }) => ({
      id,
      name,
      directoryId: contactDirectoryId,
    })),
  };
};

/** One directory of the organization, or null when the organization has no such directory. */
export const getContactDirectory = async (
  organizationId: string,
  directoryId: string
): Promise<TContactDirectory | null> => {
  const directory = await prisma.contactDirectory.findFirst({
    where: { id: directoryId, organizationId },
    select: { id: true, name: true, matchingKey: true },
  });
  if (!directory) return null;

  const [workspaces, contents] = await Promise.all([
    prisma.workspace.findMany({
      where: { contactDirectoryId: directory.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getDirectoryContents(prisma, [directory.id]),
  ]);
  const leavable = await getLeavableDirectoryIds(prisma, [directory], contents);

  return toContactDirectory(
    directory,
    workspaces.map(({ id, name }) => ({ id, name })),
    contents.get(directory.id),
    leavable
  );
};

/** The organization a directory belongs to, so a route can authorize against it. */
export const getContactDirectoryOrganizationId = async (directoryId: string): Promise<string | null> => {
  const directory = await prisma.contactDirectory.findUnique({
    where: { id: directoryId },
    select: { organizationId: true },
  });
  return directory?.organizationId ?? null;
};

/**
 * Moves the attribute values and survey filters of key `fromId` onto key `toId`, then deletes `fromId`.
 * A contact or survey that already has a row on `toId` keeps that row; its row on `fromId` goes.
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
const moveWorkspacesIntoDirectory = async (
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
    const contents = await getDirectoryContents(tx, oldDirectoryIds);
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

const runDirectoryTransaction = async <T>(operation: (tx: TClient) => Promise<T>): Promise<T> => {
  try {
    return await retryOnTransactionConflict(() => prisma.$transaction(operation));
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ContactDirectoryNameTakenError();
    throw error;
  }
};

/**
 * Creates a directory with its default keys (spec decision 25) and moves the picked workspaces into it,
 * all in one transaction. A directory always has at least one workspace (decision 21): the route's schema
 * requires one.
 */
export const createContactDirectory = async ({
  organizationId,
  name,
  matchingKey,
  workspaceIds,
}: {
  organizationId: string;
  name: string | null;
  matchingKey: TContactDirectoryMatchingKey;
  workspaceIds: string[];
}): Promise<{ id: string }> => {
  const directoryName = normalizeName(name);
  if (new Set(workspaceIds).size >= CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES && !directoryName) {
    throw new ContactDirectoryNameRequiredError();
  }

  return runDirectoryTransaction(async (tx) => {
    const directory = await tx.contactDirectory.create({
      data: { organizationId, name: directoryName, matchingKey },
      select: { id: true },
    });
    await tx.contactAttributeKey.createMany({
      data: getDefaultAttributeKeys(matchingKey).map((key) => ({
        ...key,
        type: "default" as const,
        directoryId: directory.id,
      })),
    });
    await moveWorkspacesIntoDirectory(tx, { organizationId, directoryId: directory.id, workspaceIds });
    return directory;
  });
};

type TDirectorySnapshot = { name: string | null; workspaceIds: string[] };

/**
 * Renames a directory and adds workspaces to it. `workspaceIds` is the full list: it must keep every
 * workspace the directory has, because leaving a directory is not possible in this release (decision 8).
 * Returns the directory before and after, read under its lock, for the audit log.
 */
export const updateContactDirectory = async ({
  organizationId,
  directoryId,
  name,
  workspaceIds,
}: {
  organizationId: string;
  directoryId: string;
  name?: string | null;
  workspaceIds?: string[];
}): Promise<{ previous: TDirectorySnapshot; next: TDirectorySnapshot }> =>
  runDirectoryTransaction(async (tx) => {
    const [directory] = await tx.$queryRaw<{ id: string; name: string | null }[]>`
      SELECT "id", "name" FROM "ContactDirectory"
      WHERE "organizationId" = ${organizationId} AND "id" = ${directoryId}
      FOR UPDATE
    `;
    if (!directory) throw new ContactDirectoryNotFoundError();

    const current = await tx.workspace.findMany({
      where: { contactDirectoryId: directoryId },
      select: { id: true },
    });
    const currentIds = current.map(({ id }) => id).sort();
    const nextIds = workspaceIds ? [...new Set(workspaceIds)].sort() : currentIds;

    const leaving = currentIds.filter((id) => !nextIds.includes(id));
    if (leaving.length > 0) throw new ContactDirectoryWorkspacesCannotLeaveError(leaving);

    const nextName = name === undefined ? directory.name : normalizeName(name);
    if (nextIds.length >= CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES && !nextName) {
      throw new ContactDirectoryNameRequiredError();
    }

    if (nextName !== directory.name) {
      await tx.contactDirectory.update({ where: { id: directoryId }, data: { name: nextName } });
    }
    if (workspaceIds) {
      await moveWorkspacesIntoDirectory(tx, { organizationId, directoryId, workspaceIds: nextIds });
    }

    return {
      previous: { name: directory.name, workspaceIds: currentIds },
      next: { name: nextName, workspaceIds: nextIds },
    };
  });

/** The name of the workspace's directory when other workspaces share it, for the Contacts page line. */
export const getSharedContactDirectoryName = async (workspaceId: string): Promise<string | null> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      contactDirectory: { select: { name: true, _count: { select: { workspaces: true } } } },
    },
  });
  const directory = workspace?.contactDirectory;
  if (!directory || directory._count.workspaces < CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES) return null;
  return directory.name;
};
