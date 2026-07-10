import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TOrganization,
  TOrganizationBilling,
  TOrganizationCreateInput,
  TOrganizationUpdateInput,
  ZOrganizationCreateInput,
} from "@formbricks/types/organizations";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { IS_FORMBRICKS_CLOUD, ITEMS_PER_PAGE } from "@/lib/constants";
import { updateUser } from "@/lib/user/service";
import { getBillingUsageCycleWindow } from "@/lib/utils/billing";
import { getWorkspaces } from "@/lib/workspace/service";
import { cleanupStripeCustomer } from "@/modules/ee/billing/lib/organization-billing";
import { deleteHubTenantData } from "@/modules/hub/service";
import { validateInputs } from "../utils/validate";

export const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  billing: {
    select: {
      stripeCustomerId: true,
      limits: true,
      usageCycleAnchor: true,
      stripe: true,
    },
  },
  isAISmartToolsEnabled: true,
  whitelabel: true,
} satisfies Prisma.OrganizationSelect;

type TOrganizationWithBilling = Prisma.OrganizationGetPayload<{ select: typeof select }>;

const getDefaultOrganizationBilling = (): TOrganizationBilling => ({
  limits: {
    workspaces: IS_FORMBRICKS_CLOUD ? 1 : 3,
    monthly: {
      responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
    },
  },
  stripeCustomerId: null,
  usageCycleAnchor: null,
});

const mapOrganizationBilling = (billing: TOrganizationWithBilling["billing"]): TOrganizationBilling => {
  const defaultBilling = getDefaultOrganizationBilling();

  if (!billing) {
    return defaultBilling;
  }

  return {
    stripeCustomerId: billing.stripeCustomerId,
    limits: billing.limits,
    usageCycleAnchor: billing.usageCycleAnchor,
    ...(billing.stripe == null ? {} : { stripe: billing.stripe }),
  };
};

const mapOrganization = (organization: TOrganizationWithBilling): TOrganization => ({
  id: organization.id,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt,
  name: organization.name,
  billing: mapOrganizationBilling(organization.billing),
  isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
  whitelabel: organization.whitelabel as TOrganization["whitelabel"],
});

export const getOrganizationsTag = (organizationId: string) => `organizations-${organizationId}`;
export const getOrganizationsByUserIdCacheTag = (userId: string) => `users-${userId}-organizations`;

export const getOrganizationsByUserId = reactCache(
  async (userId: string, page?: number): Promise<TOrganization[]> => {
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
      return organizations.map(mapOrganization);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getOrganizationByWorkspaceId = reactCache(
  async (workspaceId: string): Promise<TOrganization | null> => {
    validateInputs([workspaceId, ZId]);

    try {
      const organization = await prisma.organization.findFirst({
        where: {
          workspaces: {
            some: {
              id: workspaceId,
            },
          },
        },
        select: { ...select, memberships: true },
      });

      return organization ? mapOrganization(organization) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting organization by workspace id");
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getOrganization = reactCache(async (organizationId: string): Promise<TOrganization | null> => {
  validateInputs([organizationId, ZString]);

  try {
    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select,
    });
    return organization ? mapOrganization(organization) : null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const createOrganization = async (
  organizationInput: TOrganizationCreateInput
): Promise<TOrganization> => {
  try {
    validateInputs([organizationInput, ZOrganizationCreateInput]);

    const organization = await prisma.organization.create({
      data: {
        ...organizationInput,
        billing: {
          create: getDefaultOrganizationBilling(),
        },
      },
      select,
    });

    return mapOrganization(organization);
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
    const { billing, ...organizationData } = data;

    const updatedOrganization = await prisma.$transaction(async (tx) => {
      const existingOrganization = await tx.organization.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!existingOrganization) {
        throw new ResourceNotFoundError("Organization", organizationId);
      }

      if (Object.keys(organizationData).length > 0) {
        await tx.organization.update({
          where: {
            id: organizationId,
          },
          data: organizationData,
        });
      }

      if (billing) {
        const fallbackBilling = getDefaultOrganizationBilling();

        await tx.organizationBilling.upsert({
          where: {
            organizationId,
          },
          create: {
            organizationId,
            stripeCustomerId: billing.stripeCustomerId,
            limits: billing.limits,
            usageCycleAnchor: billing.usageCycleAnchor,
            ...(billing.stripe === undefined ? {} : { stripe: billing.stripe }),
          },
          update: {
            stripeCustomerId: billing.stripeCustomerId,
            limits: billing.limits ?? fallbackBilling.limits,
            usageCycleAnchor: billing.usageCycleAnchor ?? fallbackBilling.usageCycleAnchor,
            ...(billing.stripe === undefined ? {} : { stripe: billing.stripe }),
          },
        });
      }

      return tx.organization.findUnique({
        where: {
          id: organizationId,
        },
        select: { ...select, memberships: true, workspaces: { select: { id: true } } }, // include memberships & workspaces
      });
    });

    if (!updatedOrganization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const organization = {
      ...mapOrganization(updatedOrganization),
      memberships: undefined,
      workspaces: undefined,
    };

    return organization;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RelatedRecordNotFound
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
        billing: {
          select: {
            stripeCustomerId: true,
          },
        },
        memberships: {
          select: {
            userId: true,
          },
        },
        workspaces: {
          select: {
            id: true,
          },
        },
        feedbackDirectories: {
          select: {
            id: true,
          },
        },
      },
    });

    const stripeCustomerId = deletedOrganization.billing?.stripeCustomerId;
    if (IS_FORMBRICKS_CLOUD && stripeCustomerId) {
      await cleanupStripeCustomer(stripeCustomerId);
    }

    // Best-effort: purge Hub-owned data (feedback records, embeddings, webhooks) for each
    // directory tenant. Failures are logged inside the gateway and do not roll back the
    // local delete.
    for (const directory of deletedOrganization.feedbackDirectories) {
      await deleteHubTenantData(directory.id);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getMonthlyOrganizationResponseCount = reactCache(
  async (organizationId: string): Promise<number> => {
    validateInputs([organizationId, ZId]);

    try {
      const organization = await getOrganization(organizationId);
      if (!organization) {
        throw new ResourceNotFoundError("Organization", organizationId);
      }

      const usageCycleWindow = getBillingUsageCycleWindow(organization.billing);

      // Get all workspace IDs for the organization
      const workspaces = await getWorkspaces(organizationId);
      const workspaceIds = workspaces.map((workspace) => workspace.id);

      // Use Prisma's aggregate to count responses for all workspaces
      const responseAggregations = await prisma.response.aggregate({
        _count: {
          id: true,
        },
        where: {
          AND: [
            { survey: { workspaceId: { in: workspaceIds } } },
            { createdAt: { gte: usageCycleWindow.start, lt: usageCycleWindow.end } },
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
  }
);

export const subscribeOrganizationMembersToSurveyResponses = async (
  surveyId: string,
  createdBy: string,
  organizationId: string
): Promise<void> => {
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

  const defaultSettings = { alert: {} as NonNullable<TUserNotificationSettings["alert"]> };
  const updatedNotificationSettings: TUserNotificationSettings = {
    ...defaultSettings,
    ...surveyCreator.notificationSettings,
    alert: surveyCreator.notificationSettings?.alert
      ? { ...surveyCreator.notificationSettings.alert }
      : defaultSettings.alert,
  };

  updatedNotificationSettings.alert[surveyId] = true;

  await updateUser(surveyCreator.id, {
    notificationSettings: updatedNotificationSettings,
  });
};

export const getOrganizationsWhereUserIsSingleOwner = reactCache(
  async (userId: string): Promise<TOrganization[]> => {
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
          ...mapOrganization(org),
          memberships: undefined, // Remove memberships from the return object to match TOrganization type
        }));

      return filteredOrgs;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
