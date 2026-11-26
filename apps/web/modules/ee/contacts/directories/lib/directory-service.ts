import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { isUniqueConstraintError, retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import type {
  TContactDirectory,
  TContactDirectoryList,
  TContactDirectoryMatchingKey,
  TContactDirectoryTargetedSurveys,
  TContactDirectoryWorkspaceRef,
} from "../types";
import {
  CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES,
  CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT,
  getDefaultAttributeKeys,
} from "./constants";
import {
  ContactDirectoryArchiveHasWorkspacesError,
  ContactDirectoryArchivedError,
  ContactDirectoryNameRequiredError,
  ContactDirectoryNameTakenError,
  ContactDirectoryNotFoundError,
} from "./directory-errors";
import {
  type TClient,
  addWorkspacesToDirectory,
  getTargetedSurveysWhere,
  lockWorkspaces,
} from "./directory-workspaces";

/** Trims a name. Every directory has one (spec decision 2), so a blank name is refused. */
const normalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed === "") throw new ContactDirectoryNameRequiredError();
  return trimmed;
};

type TDirectoryRow = {
  id: string;
  name: string;
  matchingKey: TContactDirectoryMatchingKey;
  isArchived: boolean;
};

const DIRECTORY_SELECT = { id: true, name: true, matchingKey: true, isArchived: true } as const;

/**
 * Contacts per directory, one grouped count over the indexed `Contact.directoryId` (to check at production
 * size, where a directory can hold millions).
 */
const countContacts = async (directoryIds: string[]): Promise<Map<string, number>> => {
  if (directoryIds.length === 0) return new Map();
  const groups = await prisma.contact.groupBy({
    by: ["directoryId"],
    where: { directoryId: { in: directoryIds } },
    _count: { _all: true },
  });
  return new Map(
    groups.flatMap((row) => (row.directoryId ? [[row.directoryId, row._count._all] as const] : []))
  );
};

const toContactDirectory = (
  directory: TDirectoryRow,
  workspaces: TContactDirectoryWorkspaceRef[],
  contactCount: number
): TContactDirectory => ({
  id: directory.id,
  name: directory.name,
  matchingKey: directory.matchingKey,
  isArchived: directory.isArchived,
  workspaces,
  contactCount,
});

/**
 * Every directory of the organization, archived ones included (the list hides them unless asked), and
 * every workspace with the directory it uses.
 */
export const listContactDirectories = async (organizationId: string): Promise<TContactDirectoryList> => {
  const [directories, workspaces] = await Promise.all([
    prisma.contactDirectory.findMany({
      where: { organizationId },
      select: DIRECTORY_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspace.findMany({
      where: { organizationId },
      select: { id: true, name: true, contactDirectoryId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const contacts = await countContacts(directories.map(({ id }) => id));

  return {
    directories: directories.map((directory) =>
      toContactDirectory(
        directory,
        workspaces
          .filter((workspace) => workspace.contactDirectoryId === directory.id)
          .map(({ id, name }) => ({ id, name })),
        contacts.get(directory.id) ?? 0
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
    select: DIRECTORY_SELECT,
  });
  if (!directory) return null;

  const [workspaces, contacts] = await Promise.all([
    prisma.workspace.findMany({
      where: { contactDirectoryId: directory.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    countContacts([directory.id]),
  ]);

  return toContactDirectory(
    directory,
    workspaces.map(({ id, name }) => ({ id, name })),
    contacts.get(directory.id) ?? 0
  );
};

type TTargetedSurveyRow = {
  id: string;
  name: string;
  workspaceId: string;
  status: "inProgress" | "paused";
  totalCount: number;
};

/**
 * For each workspace of the directory, the surveys its removal would cut off (decision 2), so the Manage
 * dialog can list them before the save: the first `CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT` by name, and
 * how many there are. Null when the organization has no such directory.
 *
 * One query with window functions caps each workspace's list, where Prisma would read every survey. Its
 * filter is `getTargetedSurveysWhere`, which the save's pause uses, written in SQL; the integration test
 * checks the two list the same surveys.
 */
export const getContactDirectoryTargetedSurveys = async (
  organizationId: string,
  directoryId: string
): Promise<TContactDirectoryTargetedSurveys | null> => {
  const directory = await prisma.contactDirectory.findFirst({
    where: { id: directoryId, organizationId },
    select: { id: true },
  });
  if (!directory) return null;

  const workspaces = await prisma.workspace.findMany({
    where: { contactDirectoryId: directoryId, organizationId },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  const surveys =
    workspaces.length === 0
      ? []
      : await prisma.$queryRaw<TTargetedSurveyRow[]>`
          SELECT "id", "name", "workspaceId", "status", "totalCount"
          FROM (
            SELECT s."id", s."name", s."workspaceId", s."status",
              (COUNT(*) OVER (PARTITION BY s."workspaceId"))::int AS "totalCount",
              ROW_NUMBER() OVER (PARTITION BY s."workspaceId" ORDER BY s."name", s."id") AS "position"
            FROM "Survey" s
            JOIN "Segment" seg ON seg."id" = s."segmentId"
            WHERE s."workspaceId" IN (${Prisma.join(workspaces.map(({ id }) => id))})
              AND s."type" = 'app'
              AND s."archivedAt" IS NULL
              AND seg."filters" <> '[]'::jsonb
              AND (s."status" = 'inProgress' OR (s."status" = 'paused' AND s."publishOn" IS NOT NULL))
          ) ranked
          WHERE "position" <= ${CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT}
          ORDER BY "workspaceId", "position"
        `;

  return {
    workspaces: workspaces.map(({ id }) => {
      const ofWorkspace = surveys.filter((survey) => survey.workspaceId === id);
      return {
        workspaceId: id,
        surveys: ofWorkspace.map((survey) => ({
          id: survey.id,
          name: survey.name,
          status: survey.status === "inProgress" ? ("inProgress" as const) : ("scheduled" as const),
        })),
        totalCount: ofWorkspace[0]?.totalCount ?? 0,
      };
    }),
  };
};

/** The organization a directory belongs to, so a route can authorize against it. */
export const getContactDirectoryOrganizationId = async (directoryId: string): Promise<string | null> => {
  const directory = await prisma.contactDirectory.findUnique({
    where: { id: directoryId },
    select: { organizationId: true },
  });
  return directory?.organizationId ?? null;
};

const runDirectoryTransaction = async <T>(operation: (tx: TClient) => Promise<T>): Promise<T> => {
  try {
    return await retryOnTransactionConflict(() => prisma.$transaction(operation));
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ContactDirectoryNameTakenError();
    throw error;
  }
};

const DIRECTORY_NAME_LOCK_PREFIX = "contact-directory-name:";

/**
 * Serializes the organization's directory name checks with their writes. Without it, two saves naming
 * different directories "Northwind" and "NORTHWIND" at once would each find the name free. Taken first in
 * the transaction, before the directory and workspace row locks, so the lock order stays the same.
 */
const lockDirectoryNames = async (tx: TClient, organizationId: string): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${DIRECTORY_NAME_LOCK_PREFIX + organizationId}))`;
};

/**
 * Names are unique in an organization whatever their case, so "northwind" can't sit next to "Northwind"
 * and look like the same directory. The database's unique index only catches the exact same spelling; a
 * case-insensitive one would fail the upgrade for workspaces named "Alpha" and "alpha". Run it under
 * {@link lockDirectoryNames}.
 */
const assertDirectoryNameFree = async (
  tx: TClient,
  organizationId: string,
  name: string,
  exceptDirectoryId?: string
): Promise<void> => {
  const clash = await tx.contactDirectory.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptDirectoryId ? { id: { not: exceptDirectoryId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new ContactDirectoryNameTakenError();
};

/**
 * Creates a directory with its default keys (spec decision 25) and adds the picked workspaces to it, all in
 * one transaction. Each must have no directory (decision 3). An active directory always has at least one
 * workspace: the route's schema requires one.
 */
export const createContactDirectory = async ({
  organizationId,
  name,
  matchingKey,
  workspaceIds,
}: {
  organizationId: string;
  name: string;
  matchingKey: TContactDirectoryMatchingKey;
  workspaceIds: string[];
}): Promise<{ id: string }> => {
  const directoryName = normalizeName(name);

  return runDirectoryTransaction(async (tx) => {
    await lockDirectoryNames(tx, organizationId);
    await assertDirectoryNameFree(tx, organizationId, directoryName);
    const directory = await tx.contactDirectory.create({
      data: { organizationId, name: directoryName, matchingKey },
      select: { id: true },
    });
    await tx.contactAttributeKey.createMany({
      data: getDefaultAttributeKeys().map((key) => ({
        ...key,
        type: "default" as const,
        directoryId: directory.id,
      })),
    });
    // The new directory's row is uncommitted, so no other save can reach it before this one ends.
    const locked = await lockWorkspaces(tx, organizationId, workspaceIds);
    await addWorkspacesToDirectory(tx, { organizationId, directoryId: directory.id, workspaceIds, locked });
    return directory;
  });
};

type TDirectorySnapshot = { name: string; workspaceIds: string[]; isArchived: boolean };

/**
 * Whether the directory ends up archived (ADR 0062). Archiving is always asked for, never implied by a
 * save that leaves no workspaces, and only a directory with no workspaces can be archived. An archived
 * directory gets workspaces only by being unarchived in the same save; unarchiving needs none.
 */
const getNextArchived = ({
  wasArchived,
  isArchived,
  nextWorkspaceCount,
  addedCount,
}: {
  wasArchived: boolean;
  isArchived: boolean | undefined;
  nextWorkspaceCount: number;
  addedCount: number;
}): boolean => {
  if (wasArchived) {
    if (isArchived === false) return false;
    if (addedCount > 0) throw new ContactDirectoryArchivedError();
    return true;
  }
  if (isArchived === true) {
    if (nextWorkspaceCount > 0) throw new ContactDirectoryArchiveHasWorkspacesError();
    return true;
  }
  return false;
};

/**
 * Pauses the surveys of the given workspaces that their removal cuts off (decision 2): an in-progress one
 * is paused, a scheduled one loses its publish date so it stays paused. One statement, so a survey that
 * completed meanwhile is left alone. Returns the ids it paused, for the audit log.
 */
const pauseTargetedSurveys = async (tx: TClient, workspaceIds: string[]): Promise<string[]> => {
  if (workspaceIds.length === 0) return [];
  const paused = await tx.survey.updateManyAndReturn({
    where: getTargetedSurveysWhere(workspaceIds),
    data: { status: "paused", publishOn: null },
    select: { id: true },
  });
  return paused.map(({ id }) => id);
};

/**
 * Renames a directory, sets its workspaces and archives or unarchives it. `workspaceIds` is the full list:
 * a workspace left out is removed, which only clears its `contactDirectoryId` (decision 1). Its contacts,
 * keys, segments and its surveys' segments all stay, so adding it back restores everything. A workspace
 * added must have no directory (decision 3). `pauseSurveysInWorkspaceIds` names removed workspaces whose
 * targeted surveys are paused in the same transaction; any other id there is ignored.
 *
 * Runs under the directory's row lock, then the affected workspaces' row locks in id order, so two saves
 * of one directory run one after the other and a workspace can't join two directories at once. Returns
 * the directory before and after, read under its lock, for the audit log.
 */
export const updateContactDirectory = async ({
  organizationId,
  directoryId,
  name,
  workspaceIds,
  isArchived,
  pauseSurveysInWorkspaceIds = [],
}: {
  organizationId: string;
  directoryId: string;
  name?: string;
  workspaceIds?: string[];
  isArchived?: boolean;
  pauseSurveysInWorkspaceIds?: string[];
}): Promise<{
  previous: TDirectorySnapshot;
  next: TDirectorySnapshot & { pausedSurveyIds: string[] };
}> => {
  const nameChange = name === undefined ? undefined : normalizeName(name);

  return runDirectoryTransaction(async (tx) => {
    if (nameChange !== undefined) await lockDirectoryNames(tx, organizationId);
    const [directory] = await tx.$queryRaw<{ id: string; name: string; isArchived: boolean }[]>`
      SELECT "id", "name", "isArchived" FROM "ContactDirectory"
      WHERE "organizationId" = ${organizationId} AND "id" = ${directoryId}
      FOR UPDATE
    `;
    if (!directory) throw new ContactDirectoryNotFoundError();

    const current = await tx.workspace.findMany({
      where: { contactDirectoryId: directoryId, organizationId },
      select: { id: true },
    });
    const currentIds = current.map(({ id }) => id).sort((a, b) => a.localeCompare(b));
    const nextIds = workspaceIds ? [...new Set(workspaceIds)].sort((a, b) => a.localeCompare(b)) : currentIds;
    const adding = nextIds.filter((id) => !currentIds.includes(id));
    const removing = currentIds.filter((id) => !nextIds.includes(id));

    const nextArchived = getNextArchived({
      wasArchived: directory.isArchived,
      isArchived,
      nextWorkspaceCount: nextIds.length,
      addedCount: adding.length,
    });

    const nextName = nameChange ?? directory.name;
    if (nextName !== directory.name) {
      await assertDirectoryNameFree(tx, organizationId, nextName, directoryId);
    }

    const locked = await lockWorkspaces(tx, organizationId, [...adding, ...removing]);

    const pausedSurveyIds = await pauseTargetedSurveys(
      tx,
      removing.filter((id) => pauseSurveysInWorkspaceIds.includes(id))
    );
    if (removing.length > 0) {
      await tx.workspace.updateMany({
        where: { id: { in: removing }, organizationId, contactDirectoryId: directoryId },
        data: { contactDirectoryId: null },
      });
    }
    await addWorkspacesToDirectory(tx, { organizationId, directoryId, workspaceIds: adding, locked });

    if (nextName !== directory.name || nextArchived !== directory.isArchived) {
      await tx.contactDirectory.update({
        where: { id: directoryId },
        data: { name: nextName, isArchived: nextArchived },
      });
    }

    return {
      previous: { name: directory.name, workspaceIds: currentIds, isArchived: directory.isArchived },
      next: { name: nextName, workspaceIds: nextIds, isArchived: nextArchived, pausedSurveyIds },
    };
  });
};

/** The directory a CSV upload in this workspace writes to, with the workspaces that share it, by name. */
export const getContactDirectoryUploadDestination = async (
  workspaceId: string
): Promise<{ name: string; workspaceNames: string[] } | null> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      contactDirectory: {
        select: { name: true, workspaces: { select: { name: true }, orderBy: { name: "asc" } } },
      },
    },
  });
  const directory = workspace?.contactDirectory;
  if (!directory) return null;
  return { name: directory.name, workspaceNames: directory.workspaces.map(({ name }) => name) };
};

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
