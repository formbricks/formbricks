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
  TFeedbackRecordDirectory,
  TFeedbackRecordDirectoryDetails,
  TFeedbackRecordDirectoryUpdateInput,
  ZFeedbackRecordDirectoryUpdateInput,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";

/**
 * Retrieves all feedback record directories for a given organization.
 *
 * @param organizationId - The ID of the organization to fetch directories for.
 * @returns An array of feedback record directories with their id, name, archive status, and assigned project count.
 * @throws {ValidationError} If the organizationId fails input validation.
 * @throws {DatabaseError} If a Prisma database error occurs.
 * @throws Re-throws any other unexpected errors.
 */
export const getFeedbackRecordDirectories = reactCache(
  async (organizationId: string): Promise<TFeedbackRecordDirectory[]> => {
    validateInputs([organizationId, ZId]);
    try {
      const directories = await prisma.feedbackRecordDirectory.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
          isArchived: true,
          _count: {
            select: {
              projects: true,
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
        projectCount: dir._count.projects,
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
 * Retrieves the full details of a feedback record directory, including its assigned projects.
 *
 * @param directoryId - The ID of the directory to fetch.
 * @returns The directory details with project assignments, or `null` if not found.
 * @throws {ValidationError} If the directoryId fails input validation.
 * @throws {DatabaseError} If a Prisma database error occurs.
 * @throws Re-throws any other unexpected errors.
 */
export const getFeedbackRecordDirectoryDetails = reactCache(
  async (directoryId: string): Promise<TFeedbackRecordDirectoryDetails | null> => {
    validateInputs([directoryId, ZId]);
    try {
      const directory = await prisma.feedbackRecordDirectory.findUnique({
        where: {
          id: directoryId,
        },
        select: {
          id: true,
          name: true,
          isArchived: true,
          organizationId: true,
          projects: {
            select: {
              projectId: true,
              project: {
                select: {
                  name: true,
                },
              },
            },
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
        projects: directory.projects.map((dp) => ({
          projectId: dp.projectId,
          projectName: dp.project.name,
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
 * Creates a new feedback record directory within an organization.
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
export const createFeedbackRecordDirectory = async (
  organizationId: string,
  name: string
): Promise<string> => {
  validateInputs([organizationId, ZId], [name, z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED")]);
  try {
    const directory = await prisma.feedbackRecordDirectory.create({
      data: {
        name,
        organizationId,
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
 * Builds the Prisma nested write payload for updating project assignments on a directory.
 * Validates that all specified projects belong to the directory's organization,
 * diffs against current assignments, and returns deleteMany + upsert operations.
 *
 * @param prismaClient - The Prisma client instance used for database queries.
 * @param directoryId - The ID of the directory being updated.
 * @param projectIds - The desired project IDs to assign.
 * @param organizationId - The organization the directory belongs to.
 * @param currentProjectIds - The currently assigned project IDs (avoids a redundant fetch).
 * @returns The Prisma nested write payload for the `projects` relation.
 * @throws {InvalidInputError} If any project does not belong to the organization.
 */
const buildProjectAssignmentPayload = async (
  prismaClient: PrismaClient,
  directoryId: string,
  projectIds: string[],
  organizationId: string,
  currentProjectIds: string[]
): Promise<Prisma.FeedbackRecordDirectoryProjectUpdateManyWithoutFeedbackRecordDirectoryNestedInput> => {
  if (projectIds.length > 0) {
    const orgProjectsCount = await prismaClient.project.count({
      where: {
        id: { in: projectIds },
        organizationId,
      },
    });
    if (orgProjectsCount !== projectIds.length) {
      throw new InvalidInputError("DIRECTORY_PROJECTS_INVALID_ORG");
    }
  }

  const deletedProjectIds = currentProjectIds.filter((id) => !projectIds.includes(id));

  return {
    deleteMany: {
      projectId: { in: deletedProjectIds },
    },
    upsert: projectIds.map((projectId) => ({
      where: {
        feedbackRecordDirectoryId_projectId: {
          feedbackRecordDirectoryId: directoryId,
          projectId,
        },
      },
      update: {},
      create: { projectId },
    })),
  };
};

/**
 * Updates a feedback record directory. Supports partial updates for name, workspace
 * assignments, and archive status.
 *
 * When `projectIds` is provided, performs a diff against current assignments: removes
 * unassigned projects via `deleteMany` on the join table and upserts new/existing assignments.
 *
 * @param directoryId - The ID of the directory to update.
 * @param organizationId - The organization that owns the directory (avoids an extra fetch).
 * @param data - The partial update payload. All fields are optional.
 * @returns `true` on successful update.
 * @throws {ValidationError} If the inputs fail validation.
 * @throws {ResourceNotFoundError} If the directory does not exist (Prisma P2025).
 * @throws {InvalidInputError} If any specified project does not belong to the directory's organization,
 *   or if the name conflicts with an existing directory in the same organization.
 * @throws {DatabaseError} If a Prisma database error occurs.
 * @throws Re-throws any other unexpected errors.
 */
export const updateFeedbackRecordDirectory = async (
  directoryId: string,
  organizationId: string,
  data: TFeedbackRecordDirectoryUpdateInput
): Promise<boolean> => {
  validateInputs([directoryId, ZId], [organizationId, ZId], [data, ZFeedbackRecordDirectoryUpdateInput]);

  try {
    const { name, projectIds, isArchived } = data;

    const payload: Prisma.FeedbackRecordDirectoryUpdateInput = {};

    if (name !== undefined) {
      payload.name = name;
    }

    if (isArchived !== undefined) {
      payload.isArchived = isArchived;
    }

    if (projectIds !== undefined) {
      const currentDetails = await getFeedbackRecordDirectoryDetails(directoryId);
      const currentProjectIds = currentDetails?.projects.map((p) => p.projectId) ?? [];

      payload.projects = await buildProjectAssignmentPayload(
        prisma,
        directoryId,
        projectIds,
        organizationId,
        currentProjectIds
      );
    }

    await prisma.feedbackRecordDirectory.update({
      where: { id: directoryId },
      data: payload,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("DIRECTORY_NAME_DUPLICATE");
      }
      if (error.code === PrismaErrorType.RelatedRecordDoesNotExist) {
        throw new ResourceNotFoundError("FeedbackRecordDirectory", directoryId);
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
  const directory = await prisma.feedbackRecordDirectory.findUnique({
    where: { id: directoryId },
    select: { organizationId: true },
  });

  if (!directory) {
    throw new ResourceNotFoundError("FeedbackRecordDirectory", directoryId);
  }

  return directory.organizationId;
};
