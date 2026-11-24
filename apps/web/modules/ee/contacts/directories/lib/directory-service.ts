import "server-only";
import { prisma } from "@formbricks/database";
import { isUniqueConstraintError, retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import type {
  TContactDirectory,
  TContactDirectoryList,
  TContactDirectoryMatchingKey,
  TContactDirectoryWorkspaceRef,
} from "../types";
import { CONTACT_DIRECTORY_SHARED_MIN_WORKSPACES, getDefaultAttributeKeys } from "./constants";
import {
  ContactDirectoryNameRequiredError,
  ContactDirectoryNameTakenError,
  ContactDirectoryNotFoundError,
  ContactDirectoryWorkspacesCannotLeaveError,
} from "./directory-errors";
import {
  type TClient,
  type TDirectoryContents,
  getDirectoryContents,
  getLeavableDirectoryIds,
  moveWorkspacesIntoDirectory,
} from "./directory-move";

/** Trims a name; an empty one means "no name" (spec decision 2). */
const normalizeName = (name: string | null | undefined): string | null => {
  const trimmed = name?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
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
