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
import { capturePosthogEnvironmentEvent } from "../posthogServer";
import { getUserProjects } from "../project/service";
import { validateInputs } from "../utils/validate";

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

export const getEnvironments = reactCache(async (projectId: string): Promise<TEnvironment[]> => {
  validateInputs([projectId, ZId]);
  let projectPrisma;
  try {
    projectPrisma = await prisma.project.findFirst({
      where: {
        id: projectId,
      },
      include: {
        environments: true,
      },
    });

    if (!projectPrisma) {
      throw new ResourceNotFoundError("Project", projectId);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  const environments: TEnvironment[] = [];
  for (let environment of projectPrisma.environments) {
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
    const projects = await getUserProjects(userId, firstOrganization.id);
    if (projects.length === 0) {
      return null;
    }
    const firstProject = projects[0];
    const productionEnvironment = firstProject.environments.find(
      (environment) => environment.type === "production"
    );
    if (!productionEnvironment) {
      return null;
    }
    return productionEnvironment.id;
  } catch (error) {
    throw error;
  }
};

export const createEnvironment = async (
  projectId: string,
  environmentInput: Partial<TEnvironmentCreateInput>
): Promise<TEnvironment> => {
  validateInputs([projectId, ZId], [environmentInput, ZEnvironmentCreateInput]);

  try {
    const environment = await prisma.environment.create({
      data: {
        type: environmentInput.type || "development",
        project: { connect: { id: projectId } },
        appSetupCompleted: environmentInput.appSetupCompleted || false,
        attributeKeys: {
          create: [
            {
              key: "userId",
              name: "User Id",
              description: "The user id of a contact",
              type: "default",
              isUnique: true,
            },
            {
              key: "email",
              name: "Email",
              description: "The email of a contact",
              type: "default",
              isUnique: true,
            },
            {
              key: "firstName",
              name: "First Name",
              description: "Your contact's first name",
              type: "default",
            },
            {
              key: "lastName",
              name: "Last Name",
              description: "Your contact's last name",
              type: "default",
            },
          ],
        },
      },
    });

    await capturePosthogEnvironmentEvent(environment.id, "environment created", {
      environmentType: environment.type,
    });

    return environment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
