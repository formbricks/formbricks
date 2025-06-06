import { getBillingPeriodStartDate } from "@/lib/utils/billing";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const getOrganizationIdFromEnvironmentId = reactCache(async (environmentId: string) => {
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
      select: {
        id: true,
      },
    });

    if (!organization) {
      return err({ type: "not_found", details: [{ field: "organization", issue: "not found" }] });
    }

    return ok(organization.id);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "organization", issue: error.message }],
    });
  }
});

export const getOrganizationBilling = reactCache(async (organizationId: string) => {
  try {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
      },
      select: {
        billing: true,
      },
    });

    if (!organization) {
      return err({ type: "not_found", details: [{ field: "organization", issue: "not found" }] });
    }

    return ok(organization.billing);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "organization", issue: error.message }],
    });
  }
});

export const getAllEnvironmentsFromOrganizationId = reactCache(async (organizationId: string) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },

      select: {
        projects: {
          select: {
            environments: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return err({ type: "not_found", details: [{ field: "organization", issue: "not found" }] });
    }

    const environmentIds = organization.projects
      .flatMap((project) => project.environments)
      .map((environment) => environment.id);

    return ok(environmentIds);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "organization", issue: error.message }],
    });
  }
});

export const getMonthlyOrganizationResponseCount = reactCache(async (organizationId: string) => {
  try {
    const billing = await getOrganizationBilling(organizationId);
    if (!billing.ok) {
      return err(billing.error);
    }

    // Determine the start date based on the plan type
    const startDate = getBillingPeriodStartDate(billing.data);

    // Get all environment IDs for the organization
    const environmentIdsResult = await getAllEnvironmentsFromOrganizationId(organizationId);
    if (!environmentIdsResult.ok) {
      return err(environmentIdsResult.error);
    }

    // Use Prisma's aggregate to count responses for all environments
    const responseAggregations = await prisma.response.aggregate({
      _count: {
        id: true,
      },
      where: {
        AND: [
          { survey: { environmentId: { in: environmentIdsResult.data } } },
          { createdAt: { gte: startDate } },
        ],
      },
    });

    // The result is an aggregation of the total count
    return ok(responseAggregations._count.id);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "organization", issue: error.message }],
    });
  }
});
