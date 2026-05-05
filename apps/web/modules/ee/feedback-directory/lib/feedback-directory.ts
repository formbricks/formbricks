import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  TFeedbackDirectory,
  TFeedbackDirectoryDetails,
  TFeedbackDirectoryUpdateInput,
  TWorkspaceFeedbackDirectoryAccess,
  ZFeedbackDirectoryUpdateInput,
} from "@/modules/ee/feedback-directory/types/feedback-directory";

/**
 * Retrieves all feedback directories for a given organization.
 *
 * @param organizationId - The ID of the organization to fetch directories for.
 * @returns An array of feedback directories with their id, name, archive status, and assigned workspace count.
 * @throws {ValidationError} If the organizationId fails input validation.
 * @throws {DatabaseError} If a Prisma database error occurs.
 * @throws Re-throws any other unexpected errors.
 */
export const getFeedbackDirectories = reactCache(
  async (organizationId: string): Promise<TFeedbackDirectory[]> => {
    validateInputs([organizationId, ZId]);
    try {
      const directories = await prisma.feedbackDirectory.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
          isArchived: true,
          _count: {
            select: {
              workspaces: true,
              connectors: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return directories.map((dir) => ({
        id: dir.id,
        name: dir.name,
        isArchived: dir.isArchived,
        workspaceCount: dir._count.workspaces,
        connectorCount: dir._count.connectors,
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Retrieves the full details of a feedback directory, including its assigned workspaces.
 *
 * @param directoryId - The ID of the directory to fetch.
 * @returns The directory details with workspace assignments, or `null` if not found.
 * @throws {ValidationError} If the directoryId fails input validation.
 * @throws {DatabaseError} If a Prisma database error occurs.
 * @throws Re-throws any other unexpected errors.
 */
/**
 * Lists feedback directories assigned to a workspace.
 * Used by connector creation to pick a feedback directory.
 */
export const getFeedbackDirectoriesByWorkspaceId = reactCache(
  async (workspaceId: string): Promise<{ id: string; name: string }[]> => {
    validateInputs([workspaceId, ZId]);
    try {
      const rows = await prisma.feedbackDirectoryWorkspace.findMany({
        where: {
          workspaceId,
          feedbackDirectory: { isArchived: false },
        },
        select: {
          feedbackDirectory: { select: { id: true, name: true } },
        },
      });
      return rows.map((r) => r.feedbackDirectory);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getFeedbackDirectoryAuthContext = reactCache(
  async (
    directoryId: string
  ): Promise<{ organizationId: string; workspaceIds: string[]; isArchived: boolean } | null> => {
    validateInputs([directoryId, ZId]);
    try {
      const directory = await prisma.feedbackDirectory.findUnique({
        where: { id: directoryId },
        select: {
          organizationId: true,
          isArchived: true,
          workspaces: {
            select: {
              workspaceId: true,
            },
          },
        },
      });

      if (!directory) {
        return null;
      }

      return {
        organizationId: directory.organizationId,
        workspaceIds: directory.workspaces.map((workspace) => workspace.workspaceId),
        isArchived: directory.isArchived,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Lists active feedback directory access assignments by workspace for an organization.
 * Each workspace appears once with the first active directory assignment found.
 */
export const getWorkspaceFeedbackDirectoryAccess = reactCache(
  async (organizationId: string): Promise<TWorkspaceFeedbackDirectoryAccess[]> => {
    validateInputs([organizationId, ZId]);
    try {
      const rows = await prisma.feedbackDirectoryWorkspace.findMany({
        where: {
          feedbackDirectory: {
            organizationId,
            isArchived: false,
          },
        },
        select: {
          workspaceId: true,
          feedbackDirectory: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ workspaceId: "asc" }, { createdAt: "asc" }],
      });

      const accessByWorkspaceId = new Map<string, TWorkspaceFeedbackDirectoryAccess>();

      for (const row of rows) {
        if (!accessByWorkspaceId.has(row.workspaceId)) {
          accessByWorkspaceId.set(row.workspaceId, {
            workspaceId: row.workspaceId,
            feedbackDirectoryId: row.feedbackDirectory.id,
            feedbackDirectoryName: row.feedbackDirectory.name,
          });
        }
      }

      return Array.from(accessByWorkspaceId.values());
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getFeedbackDirectoryDetails = reactCache(
  async (directoryId: string): Promise<TFeedbackDirectoryDetails | null> => {
    validateInputs([directoryId, ZId]);
    try {
      const directory = await prisma.feedbackDirectory.findUnique({
        where: {
          id: directoryId,
        },
        select: {
          id: true,
          name: true,
          isArchived: true,
          organizationId: true,
          workspaces: {
            select: {
              workspaceId: true,
              workspace: {
                select: {
                  name: true,
                },
              },
            },
          },
          connectors: {
            select: {
              id: true,
              name: true,
              type: true,
              workspaceId: true,
              workspace: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!directory) {
        return null;
      }

      return {
        id: directory.id,
        name: directory.name,
        isArchived: directory.isArchived,
        organizationId: directory.organizationId,
        workspaces: directory.workspaces.map((dp) => ({
          workspaceId: dp.workspaceId,
          workspaceName: dp.workspace.name,
        })),
        connectors: directory.connectors.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          workspaceId: c.workspaceId,
          workspaceName: c.workspace.name,
        })),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Creates a new feedback directory within an organization.
 *
 * @param organizationId - The ID of the organization to create the directory in.
 * @param name - The name for the new directory.
 * @returns The ID of the newly created directory.
 * @throws {ValidationError} If the inputs fail validation.
 * @throws {InvalidInputError} If a directory with the same name already exists in the organization,
 *   or if the name is empty.
 * @throws {DatabaseError} If a Prisma database error occurs.
 * @throws Re-throws any other unexpected errors.
 */
export const createFeedbackDirectory = async (
  organizationId: string,
  name: string,
  workspaceIds?: string[]
): Promise<string> => {
  validateInputs([organizationId, ZId], [name, z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED")]);
  try {
    // Verify workspaces belong to same org
    if (workspaceIds?.length) {
      const count = await prisma.workspace.count({
        where: { id: { in: workspaceIds }, organizationId },
      });
      if (count !== workspaceIds.length) {
        throw new InvalidInputError("DIRECTORY_WORKSPACES_INVALID_ORG");
      }
    }

    const directory = await prisma.feedbackDirectory.create({
      data: {
        name,
        organizationId,
        workspaces: workspaceIds?.length
          ? { create: workspaceIds.map((workspaceId) => ({ workspaceId })) }
          : undefined,
      },
      select: {
        id: true,
      },
    });

    return directory.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("DIRECTORY_NAME_DUPLICATE");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Builds the Prisma nested write payload for updating workspace assignments on a directory.
 * Validates that all specified workspaces belong to the directory's organization,
 * diffs against current assignments, and returns deleteMany + upsert operations.
 *
 * @param prismaClient - The Prisma client instance used for database queries.
 * @param directoryId - The ID of the directory being updated.
 * @param workspaceIds - The desired workspace IDs to assign.
 * @param organizationId - The organization the directory belongs to.
 * @param currentWorkspaceIds - The currently assigned workspace IDs (avoids a redundant fetch).
 * @returns The Prisma nested write payload for the `workspaces` relation.
 * @throws {InvalidInputError} If any workspace does not belong to the organization.
 */
const buildWorkspaceAssignmentPayload = async (
  prismaClient: PrismaClient,
  directoryId: string,
  workspaceIds: string[],
  organizationId: string,
  currentWorkspaceIds: string[]
): Promise<{
  payload: Prisma.FeedbackDirectoryWorkspaceUpdateManyWithoutFeedbackDirectoryNestedInput;
  deletedWorkspaceIds: string[];
}> => {
  if (workspaceIds.length > 0) {
    const orgWorkspacesCount = await prismaClient.workspace.count({
      where: {
        id: { in: workspaceIds },
        organizationId,
      },
    });
    if (orgWorkspacesCount !== workspaceIds.length) {
      throw new InvalidInputError("DIRECTORY_WORKSPACES_INVALID_ORG");
    }
  }

  const deletedWorkspaceIds = currentWorkspaceIds.filter((id) => !workspaceIds.includes(id));

  return {
    payload: {
      deleteMany: {
        workspaceId: { in: deletedWorkspaceIds },
      },
      upsert: workspaceIds.map((workspaceId) => ({
        where: {
          feedbackDirectoryId_workspaceId: {
            feedbackDirectoryId: directoryId,
            workspaceId,
          },
        },
        update: {},
        create: { workspaceId },
      })),
    },
    deletedWorkspaceIds,
  };
};

interface UpdateFeedbackDirectoryOptions {
  pauseConnectorsInRemovedWorkspaces?: boolean;
}

const getArchiveUpdate = async (
  directoryId: string,
  isArchived: boolean | undefined
): Promise<Pick<Prisma.FeedbackDirectoryUpdateInput, "isArchived">> => {
  if (isArchived === true) {
    const connectorCount = await prisma.connector.count({
      where: { feedbackDirectoryId: directoryId },
    });
    if (connectorCount > 0) {
      throw new InvalidInputError("DIRECTORY_HAS_CONNECTORS");
    }
    return { isArchived: true };
  }

  if (isArchived === false) {
    return { isArchived: false };
  }

  return {};
};

const getWorkspaceAssignmentUpdate = async (
  directoryId: string,
  organizationId: string,
  workspaceIds: string[] | undefined
): Promise<{
  workspaces?: Prisma.FeedbackDirectoryWorkspaceUpdateManyWithoutFeedbackDirectoryNestedInput;
  removedWorkspaceIds: string[];
}> => {
  if (workspaceIds === undefined) {
    return { removedWorkspaceIds: [] };
  }

  const currentDetails = await getFeedbackDirectoryDetails(directoryId);
  const currentWorkspaceIds = currentDetails?.workspaces.map((workspace) => workspace.workspaceId) ?? [];
  const assignmentPayload = await buildWorkspaceAssignmentPayload(
    prisma,
    directoryId,
    workspaceIds,
    organizationId,
    currentWorkspaceIds
  );

  return {
    workspaces: assignmentPayload.payload,
    removedWorkspaceIds: assignmentPayload.deletedWorkspaceIds,
  };
};

const pauseConnectorsInWorkspaces = async (
  tx: Prisma.TransactionClient,
  directoryId: string,
  workspaceIds: string[]
): Promise<void> => {
  if (workspaceIds.length === 0) {
    return;
  }

  await tx.connector.updateMany({
    where: {
      feedbackDirectoryId: directoryId,
      workspaceId: { in: workspaceIds },
    },
    data: {
      status: "paused",
    },
  });
};

/**
 * Enforces the single-active-FRD-per-workspace invariant. The client UI prevents
 * assigning a workspace to multiple active directories, but the server must also
 * reject such payloads to keep this guarantee under direct API access.
 */
const assertWorkspacesNotAssignedElsewhere = async (
  directoryId: string,
  workspaceIds: string[]
): Promise<void> => {
  if (workspaceIds.length === 0) return;

  const conflicting = await prisma.feedbackDirectoryWorkspace.findFirst({
    where: {
      workspaceId: { in: workspaceIds },
      feedbackDirectoryId: { not: directoryId },
      feedbackDirectory: { isArchived: false },
    },
    select: { workspaceId: true },
  });

  if (conflicting) {
    throw new InvalidInputError("WORKSPACE_ALREADY_ASSIGNED_TO_DIFFERENT_DIRECTORY");
  }
};

/**
 * Updates a feedback directory. Supports partial updates for name, workspace
 * assignments, and archive status.
 *
 * When `workspaceIds` is provided, performs a diff against current assignments: removes
 * unassigned workspaces via `deleteMany` on the join table and upserts new/existing assignments.
 *
 * @param directoryId - The ID of the directory to update.
 * @param organizationId - The organization that owns the directory (avoids an extra fetch).
 * @param data - The partial update payload. All fields are optional.
 * @returns `true` on successful update.
 * @throws {ValidationError} If the inputs fail validation.
 * @throws {ResourceNotFoundError} If the directory does not exist (Prisma P2025).
 * @throws {InvalidInputError} If any specified workspace does not belong to the directory's organization,
 *   or if the name conflicts with an existing directory in the same organization.
 * @throws {DatabaseError} If a Prisma database error occurs.
 * @throws Re-throws any other unexpected errors.
 */
export const updateFeedbackDirectory = async (
  directoryId: string,
  organizationId: string,
  data: TFeedbackDirectoryUpdateInput,
  options?: UpdateFeedbackDirectoryOptions
): Promise<boolean> => {
  validateInputs([directoryId, ZId], [organizationId, ZId], [data, ZFeedbackDirectoryUpdateInput]);

  try {
    const { name, workspaceIds, isArchived } = data;

    if (workspaceIds !== undefined) {
      await assertWorkspacesNotAssignedElsewhere(directoryId, workspaceIds);
    }

    const archiveUpdate = await getArchiveUpdate(directoryId, isArchived);
    const workspaceAssignmentUpdate = await getWorkspaceAssignmentUpdate(
      directoryId,
      organizationId,
      workspaceIds
    );

    const payload: Prisma.FeedbackDirectoryUpdateInput = {
      ...(name !== undefined ? { name } : {}),
      ...archiveUpdate,
      ...(workspaceAssignmentUpdate.workspaces ? { workspaces: workspaceAssignmentUpdate.workspaces } : {}),
    };

    await prisma.$transaction(async (tx) => {
      await tx.feedbackDirectory.update({
        where: { id: directoryId },
        data: payload,
      });

      if (options?.pauseConnectorsInRemovedWorkspaces) {
        await pauseConnectorsInWorkspaces(tx, directoryId, workspaceAssignmentUpdate.removedWorkspaceIds);
      }
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("DIRECTORY_NAME_DUPLICATE");
      }
      if (error.code === PrismaErrorType.RelatedRecordDoesNotExist) {
        throw new ResourceNotFoundError("FeedbackDirectory", directoryId);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Resolves the owning organization ID for a given directory.
 *
 * Used by server actions to determine the organization context for authorization checks.
 *
 * @param directoryId - The ID of the directory to look up.
 * @returns The organization ID that owns the directory.
 * @throws {ValidationError} If the directoryId fails input validation.
 * @throws {ResourceNotFoundError} If the directory does not exist.
 */
export const getOrganizationIdFromDirectoryId = async (directoryId: string): Promise<string> => {
  validateInputs([directoryId, ZId]);
  const directory = await prisma.feedbackDirectory.findUnique({
    where: { id: directoryId },
    select: { organizationId: true },
  });

  if (!directory) {
    throw new ResourceNotFoundError("FeedbackDirectory", directoryId);
  }

  return directory.organizationId;
};
