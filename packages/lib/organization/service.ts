import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/src/types/error";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TOrganization,
  TOrganizationCreateInput,
  TOrganizationUpdateInput,
  ZOrganizationCreateInput,
} from "@formbricks/types/organizations";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { cache } from "../cache";
import { BILLING_LIMITS, ITEMS_PER_PAGE, PROJECT_FEATURE_KEYS } from "../constants";
import { environmentCache } from "../environment/cache";
import { getProjects } from "../project/service";
import { updateUser } from "../user/service";
import { validateInputs } from "../utils/validate";
import { organizationCache } from "./cache";

export const select: Prisma.OrganizationSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  billing: true,
  isAIEnabled: true,
  whitelabel: true,
};

export const getOrganizationsTag = (organizationId: string) => `organizations-${organizationId}`;
export const getOrganizationsByUserIdCacheTag = (userId: string) => `users-${userId}-organizations`;
export const getOrganizationByEnvironmentIdCacheTag = (environmentId: string) =>
  `environments-${environmentId}-organization`;

export const getOrganizationsByUserId = reactCache(
  async (userId: string, page?: number): Promise<TOrganization[]> =>
    cache(
      async () => {
        validateInputs([userId, ZString], [page, ZOptionalNumber]);

        try {
          const organizations = await prisma.organization.findMany({
            where: {
              memberships: {
                some: {
                  userId,
                },
              },
            },
            select,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });
          if (!organizations) {
            throw new ResourceNotFoundError("Organizations by UserId", userId);
          }
          return organizations;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getOrganizationsByUserId-${userId}-${page}`],
      {
        tags: [organizationCache.tag.byUserId(userId)],
      }
    )()
);

export const getOrganizationByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TOrganization | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          const organization = await prisma.organization.findFirst({
            where: {
              projects: {
                some: {
                  environments: {
                    some: {
                      id: environmentId,
                    },
                  },
                },
              },
            },
            select: { ...select, memberships: true }, // include memberships
          });

          return organization;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getOrganizationByEnvironmentId-${environmentId}`],
      {
        tags: [organizationCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getOrganization = reactCache(
  async (organizationId: string): Promise<TOrganization | null> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString]);

        try {
          const organization = await prisma.organization.findUnique({
            where: {
              id: organizationId,
            },
            select,
          });
          return organization;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getOrganization-${organizationId}`],
      {
        tags: [organizationCache.tag.byId(organizationId)],
      }
    )()
);

export const createOrganization = async (
  organizationInput: TOrganizationCreateInput
): Promise<TOrganization> => {
  try {
    validateInputs([organizationInput, ZOrganizationCreateInput]);

    const organization = await prisma.organization.create({
      data: {
        ...organizationInput,
        billing: {
          plan: PROJECT_FEATURE_KEYS.FREE,
          limits: {
            projects: BILLING_LIMITS.FREE.PROJECTS,
            monthly: {
              responses: BILLING_LIMITS.FREE.RESPONSES,
              miu: BILLING_LIMITS.FREE.MIU,
            },
          },
          stripeCustomerId: null,
          periodStart: new Date(),
          period: "monthly",
        },
      },
      select,
    });

    organizationCache.revalidate({
      id: organization.id,
      count: true,
    });

    return organization;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateOrganization = async (
  organizationId: string,
  data: Partial<TOrganizationUpdateInput>
): Promise<TOrganization> => {
  try {
    const updatedOrganization = await prisma.organization.update({
      where: {
        id: organizationId,
      },
      data,
      select: { ...select, memberships: true, projects: { select: { environments: true } } }, // include memberships & environments
    });

    // revalidate cache for members
    updatedOrganization?.memberships.forEach((membership) => {
      organizationCache.revalidate({
        userId: membership.userId,
      });
    });

    // revalidate cache for environments
    for (const project of updatedOrganization.projects) {
      for (const environment of project.environments) {
        organizationCache.revalidate({
          environmentId: environment.id,
        });
      }
    }

    const organization = {
      ...updatedOrganization,
      memberships: undefined,
      projects: undefined,
    };

    organizationCache.revalidate({
      id: organization.id,
    });

    return organization;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }
    throw error; // Re-throw any other errors
  }
};

export const deleteOrganization = async (organizationId: string) => {
  validateInputs([organizationId, ZId]);
  try {
    const deletedOrganization = await prisma.organization.delete({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
        name: true,
        memberships: {
          select: {
            userId: true,
          },
        },
        projects: {
          select: {
            id: true,
            environments: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // revalidate cache for members
    deletedOrganization?.memberships.forEach((membership) => {
      organizationCache.revalidate({
        userId: membership.userId,
      });
    });

    // revalidate cache for environments
    deletedOrganization?.projects.forEach((project) => {
      project.environments.forEach((environment) => {
        environmentCache.revalidate({
          id: environment.id,
        });

        organizationCache.revalidate({
          environmentId: environment.id,
        });
      });
    });

    const organization = {
      ...deletedOrganization,
      memberships: undefined,
      projects: undefined,
    };

    organizationCache.revalidate({
      id: organization.id,
      count: true,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getMonthlyActiveOrganizationPeopleCount = reactCache(
  async (organizationId: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);

        try {
          // temporary solution until we have a better way to track active users
          return 0;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getMonthlyActiveOrganizationPeopleCount-${organizationId}`],
      {
        revalidate: 60 * 60 * 2, // 2 hours
      }
    )()
);

export const getMonthlyOrganizationResponseCount = reactCache(
  async (organizationId: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);

        try {
          const organization = await getOrganization(organizationId);
          if (!organization) {
            throw new ResourceNotFoundError("Organization", organizationId);
          }

          // Determine the start date based on the plan type
          let startDate: Date;
          if (organization.billing.plan === "free") {
            // For free plans, use the first day of the current calendar month
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          } else {
            // For other plans, use the periodStart from billing
            if (!organization.billing.periodStart) {
              throw new Error("Organization billing period start is not set");
            }
            startDate = organization.billing.periodStart;
          }

          // Get all environment IDs for the organization
          const projects = await getProjects(organizationId);
          const environmentIds = projects.flatMap((project) => project.environments.map((env) => env.id));

          // Use Prisma's aggregate to count responses for all environments
          const responseAggregations = await prisma.response.aggregate({
            _count: {
              id: true,
            },
            where: {
              AND: [{ survey: { environmentId: { in: environmentIds } } }, { createdAt: { gte: startDate } }],
            },
          });

          // The result is an aggregation of the total count
          return responseAggregations._count.id;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getMonthlyOrganizationResponseCount-${organizationId}`],
      {
        revalidate: 60 * 60 * 2, // 2 hours
      }
    )()
);

export const subscribeOrganizationMembersToSurveyResponses = async (
  surveyId: string,
  createdBy: string,
  organizationId: string
): Promise<void> => {
  try {
    const surveyCreator = await prisma.user.findUnique({
      where: {
        id: createdBy,
      },
    });

    if (!surveyCreator) {
      throw new ResourceNotFoundError("User", createdBy);
    }

    if (surveyCreator.notificationSettings?.unsubscribedOrganizationIds?.includes(organizationId)) {
      return;
    }

    const defaultSettings = { alert: {}, weeklySummary: {} };
    const updatedNotificationSettings: TUserNotificationSettings = {
      ...defaultSettings,
      ...surveyCreator.notificationSettings,
    };

    updatedNotificationSettings.alert[surveyId] = true;

    await updateUser(surveyCreator.id, {
      notificationSettings: updatedNotificationSettings,
    });
  } catch (error) {
    throw error;
  }
};

export const getOrganizationsWhereUserIsSingleOwner = reactCache(
  async (userId: string): Promise<TOrganization[]> =>
    cache(
      async () => {
        validateInputs([userId, ZString]);
        try {
          const orgs = await prisma.organization.findMany({
            where: {
              memberships: {
                some: {
                  userId,
                  role: "owner",
                },
              },
            },
            select: {
              ...select,
              memberships: {
                where: {
                  role: "owner",
                },
              },
            },
          });

          // Filter to only include orgs where there is exactly one owner
          const filteredOrgs = orgs
            .filter((org) => org.memberships.length === 1)
            .map((org) => ({
              ...org,
              memberships: undefined, // Remove memberships from the return object to match TOrganization type
            }));

          return filteredOrgs;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getOrganizationsWhereUserIsSingleOwner-${userId}`],
      {
        tags: [organizationCache.tag.byUserId(userId)],
      }
    )()
);
