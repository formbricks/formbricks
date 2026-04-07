import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import type {
  TEnvironment,
  TEnvironmentCreateInput,
  TEnvironmentUpdateInput,
} from "@formbricks/types/environment";
import {
  ZEnvironment,
  ZEnvironmentCreateInput,
  ZEnvironmentUpdateInput,
} from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { getOrganizationsByUserId } from "../organization/service";
import { validateInputs } from "../utils/validate";
import { getUserWorkspaces } from "../workspace/service";

export const getEnvironment = reactCache(async (environmentId: string): Promise<TEnvironment | null> => {
  validateInputs([environmentId, ZId]);

  try {
    const environment = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
    });
    return environment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error getting environment");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getEnvironments = reactCache(async (workspaceId: string): Promise<TEnvironment[]> => {
  validateInputs([workspaceId, ZId]);
  let workspacePrisma;
  try {
    workspacePrisma = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
      },
      include: {
        environments: true,
      },
    });

    if (!workspacePrisma) {
      throw new ResourceNotFoundError("Workspace", workspaceId);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  const environments: TEnvironment[] = [];
  for (let environment of workspacePrisma.environments) {
    let targetEnvironment: TEnvironment = ZEnvironment.parse(environment);
    environments.push(targetEnvironment);
  }

  try {
    return environments;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(error, "Error getting environments");
    }
    throw new ValidationError("Data validation of environments array failed");
  }
});

export const updateEnvironment = async (
  environmentId: string,
  data: Partial<TEnvironmentUpdateInput>
): Promise<TEnvironment> => {
  validateInputs([environmentId, ZId], [data, ZEnvironmentUpdateInput.partial()]);
  const newData = { ...data, updatedAt: new Date() };
  let updatedEnvironment;
  try {
    updatedEnvironment = await prisma.environment.update({
      where: {
        id: environmentId,
      },
      data: newData,
    });

    return updatedEnvironment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getFirstEnvironmentIdByUserId = async (userId: string): Promise<string | null> => {
  try {
    const organizations = await getOrganizationsByUserId(userId);
    if (organizations.length === 0) {
      return null;
    }
    const firstOrganization = organizations[0];
    const workspaces = await getUserWorkspaces(userId, firstOrganization.id);
    if (workspaces.length === 0) {
      return null;
    }
    const firstWorkspace = workspaces[0];
    const environment = firstWorkspace.environments[0];
    if (!environment) {
      return null;
    }
    return environment.id;
  } catch (error) {
    throw error;
  }
};

export const createEnvironment = async (
  workspaceId: string,
  environmentInput: Partial<TEnvironmentCreateInput>
): Promise<TEnvironment> => {
  validateInputs([workspaceId, ZId], [environmentInput, ZEnvironmentCreateInput]);

  try {
    const environment = await prisma.environment.create({
      data: {
        type: environmentInput.type || "production",
        workspace: { connect: { id: workspaceId } },
        appSetupCompleted: environmentInput.appSetupCompleted || false,
        attributeKeys: {
          create: [
            {
              key: "userId",
              name: "User Id",
              description: "The user id of a contact",
              type: "default",
              isUnique: true,
              workspaceId: workspaceId,
            },
            {
              key: "email",
              name: "Email",
              description: "The email of a contact",
              type: "default",
              isUnique: true,
              workspaceId: workspaceId,
            },
            {
              key: "firstName",
              name: "First Name",
              description: "Your contact's first name",
              type: "default",
              workspaceId: workspaceId,
            },
            {
              key: "lastName",
              name: "Last Name",
              description: "Your contact's last name",
              type: "default",
              workspaceId: workspaceId,
            },
            {
              key: "language",
              name: "Language",
              description: "The language preference of a contact",
              type: "default",
              workspaceId: workspaceId,
            },
          ],
        },
      },
    });

    return environment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
