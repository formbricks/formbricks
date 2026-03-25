import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";

/**
 * Resolves an environmentId or projectId to a projectId.
 *
 * Tries the Environment table first. If no environment is found,
 * falls back to the Project table (the caller may already be passing a projectId).
 * This is the single indirection point used during the environments-deprecation migration.
 */
export const resolveToProjectId = reactCache(async (environmentIdOrProjectId: string): Promise<string> => {
  validateInputs([environmentIdOrProjectId, ZId]);

  try {
    // Try Environment table first
    const environment = await prisma.environment.findUnique({
      where: { id: environmentIdOrProjectId },
      select: { projectId: true },
    });

    if (environment) {
      return environment.projectId;
    }

    // Fall back to Project table — the input may already be a projectId
    const project = await prisma.project.findUnique({
      where: { id: environmentIdOrProjectId },
      select: { id: true },
    });

    if (project) {
      return project.id;
    }

    throw new ResourceNotFoundError("environment or project", environmentIdOrProjectId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error resolving environment/project id");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Resolves an environmentId to both its own id and the parent projectId.
 *
 * Unlike `resolveToProjectId`, this requires the input to be a valid environmentId.
 */
export const resolveEnvironmentToProject = reactCache(
  async (environmentId: string): Promise<{ projectId: string; environmentId: string }> => {
    validateInputs([environmentId, ZId]);

    try {
      const environment = await prisma.environment.findUnique({
        where: { id: environmentId },
        select: { projectId: true },
      });

      if (!environment) {
        throw new ResourceNotFoundError("environment", environmentId);
      }

      return { projectId: environment.projectId, environmentId };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error resolving environment to project");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
