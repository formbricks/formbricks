import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
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
import { BILLING_LIMITS, ITEMS_PER_PAGE, PRODUCT_FEATURE_KEYS } from "../constants";
import { environmentCache } from "../environment/cache";
import { getProducts } from "../product/service";
import { updateUser } from "../user/service";
import { validateInputs } from "../utils/validate";
import { organizationCache } from "./cache";

export const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  billing: true,
};

export const getOrganizationsTag = (organizationId: string) => `organizations-${organizationId}`;
export const getOrganizationsByUserIdCacheTag = (userId: string) => `users-${userId}-organizations`;
export const getOrganizationByEnvironmentIdCacheTag = (environmentId: string) =>
  `environments-${environmentId}-organization`;

export const getOrganizationsByUserId = reactCache(
  (userId: string, page?: number): Promise<TOrganization[]> =>
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
  (environmentId: string): Promise<TOrganization | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          const organization = await prisma.organization.findFirst({
            where: {
              products: {
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
  (organizationId: string): Promise<TOrganization | null> =>
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
          plan: PRODUCT_FEATURE_KEYS.FREE,
          limits: {
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
      select: { ...select, memberships: true, products: { select: { environments: true } } }, // include memberships & environments
    });

    // revalidate cache for members
    updatedOrganization?.memberships.forEach((membership) => {
      organizationCache.revalidate({
        userId: membership.userId,
      });
    });

    // revalidate cache for environments
    updatedOrganization?.products.forEach((product) => {
      product.environments.forEach(async (environment) => {
        organizationCache.revalidate({
          environmentId: environment.id,
        });
      });
    });

    const organization = {
      ...updatedOrganization,
      memberships: undefined,
      products: undefined,
    };

    organizationCache.revalidate({
      id: organization.id,
    });

    return organization;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Organization", organizationId);
    }
    throw error; // Re-throw any other errors
  }
};

export const deleteOrganization = async (organizationId: string): Promise<TOrganization> => {
  validateInputs([organizationId, ZId]);
  try {
    const deletedOrganization = await prisma.organization.delete({
      where: {
        id: organizationId,
      },
      select: { ...select, memberships: true, products: { select: { environments: true } } }, // include memberships & environments
    });

    // revalidate cache for members
    deletedOrganization?.memberships.forEach((membership) => {
      organizationCache.revalidate({
        userId: membership.userId,
      });
    });

    // revalidate cache for environments
    deletedOrganization?.products.forEach((product) => {
      product.environments.forEach((environment) => {
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
      products: undefined,
    };

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

export const getMonthlyActiveOrganizationPeopleCount = reactCache(
  (organizationId: string): Promise<number> =>
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
  (organizationId: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);

        try {
          // Define the start of the month
          // const now = new Date();
          // const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          const organization = await getOrganization(organizationId);
          if (!organization) {
            throw new ResourceNotFoundError("Organization", organizationId);
          }

          if (!organization.billing.periodStart) {
            throw new Error("Organization billing period start is not set");
          }

          // Get all environment IDs for the organization
          const products = await getProducts(organizationId);
          const environmentIds = products.flatMap((product) => product.environments.map((env) => env.id));

          // Use Prisma's aggregate to count responses for all environments
          const responseAggregations = await prisma.response.aggregate({
            _count: {
              id: true,
            },
            where: {
              AND: [
                { survey: { environmentId: { in: environmentIds } } },
                { createdAt: { gte: organization.billing.periodStart } },
              ],
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
  createdBy: string
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
