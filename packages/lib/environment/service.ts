import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
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
import { cache } from "../cache";
import { getOrganizationsByUserId } from "../organization/service";
import { capturePosthogEnvironmentEvent } from "../posthogServer";
import { getUserProjects } from "../project/service";
import { validateInputs } from "../utils/validate";
import { environmentCache } from "./cache";

export const getEnvironment = reactCache(
  async (environmentId: string): Promise<TEnvironment | null> =>
    cache(
      async () => {
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
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getEnvironment-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);

export const getEnvironments = reactCache(
  async (projectId: string): Promise<TEnvironment[]> =>
    cache(
      async (): Promise<TEnvironment[]> => {
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
            console.error(JSON.stringify(error.errors, null, 2));
          }
          throw new ValidationError("Data validation of environments array failed");
        }
      },
      [`getEnvironments-${projectId}`],
      {
        tags: [environmentCache.tag.byProjectId(projectId)],
      }
    )()
);

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

    environmentCache.revalidate({
      id: environmentId,
      projectId: updatedEnvironment.projectId,
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
      throw new Error(`Unable to get first environment: User ${userId} has no organizations`);
    }
    const firstOrganization = organizations[0];
    const projects = await getUserProjects(userId, firstOrganization.id);
    if (projects.length === 0) {
      throw new Error(
        `Unable to get first environment: Organization ${firstOrganization.id} has no projects`
      );
    }
    const firstProject = projects[0];
    const productionEnvironment = firstProject.environments.find(
      (environment) => environment.type === "production"
    );
    if (!productionEnvironment) {
      throw new Error(
        `Unable to get first environment: Project ${firstProject.id} has no production environment`
      );
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
        actionClasses: {
          create: [
            {
              name: "New Session",
              description: "Gets fired when a new session is created",
              type: "automatic",
            },
          ],
        },
        attributeClasses: {
          create: [
            // { name: "userId", description: "The internal ID of the person", type: "automatic" },
            { name: "email", description: "The email of the person", type: "automatic" },
            { name: "language", description: "The language used by the person", type: "automatic" },
          ],
        },
      },
    });

    environmentCache.revalidate({
      id: environment.id,
      projectId: environment.projectId,
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
