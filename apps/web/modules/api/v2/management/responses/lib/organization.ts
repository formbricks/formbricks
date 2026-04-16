import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { getBillingUsageCycleWindow } from "@/lib/utils/billing";

export const getOrganizationIdFromWorkspaceId = reactCache(async (workspaceId: string) => {
  try {
    const organization = await prisma.organization.findFirst({
      where: {
        workspaces: {
          some: {
            id: workspaceId,
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
      details: [
        { field: "organization", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
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
        billing: {
          select: {
            stripeCustomerId: true,
            limits: true,
            usageCycleAnchor: true,
            stripe: true,
          },
        },
      },
    });

    if (!organization?.billing) {
      return err({ type: "not_found", details: [{ field: "organization", issue: "not found" }] });
    }

    return ok({
      stripeCustomerId: organization.billing.stripeCustomerId,
      limits: organization.billing.limits as TOrganizationBilling["limits"],
      usageCycleAnchor: organization.billing.usageCycleAnchor,
      ...(organization.billing.stripe === null ? {} : { stripe: organization.billing.stripe }),
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "organization", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
});

export const getAllWorkspaceIdsFromOrganizationId = reactCache(async (organizationId: string) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        workspaces: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!organization) {
      return err({ type: "not_found", details: [{ field: "organization", issue: "not found" }] });
    }

    const workspaceIds = organization.workspaces.map((workspace) => workspace.id);

    return ok(workspaceIds);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "organization", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
});

export const getMonthlyOrganizationResponseCount = reactCache(async (organizationId: string) => {
  try {
    const billing = await getOrganizationBilling(organizationId);
    if (!billing.ok) {
      return err(billing.error);
    }

    const usageCycleWindow = getBillingUsageCycleWindow(billing.data);

    // Get all workspace IDs for the organization
    const workspaceIdsResult = await getAllWorkspaceIdsFromOrganizationId(organizationId);
    if (!workspaceIdsResult.ok) {
      return err(workspaceIdsResult.error);
    }

    // Use Prisma's aggregate to count responses for all workspaces
    const responseAggregations = await prisma.response.aggregate({
      _count: {
        id: true,
      },
      where: {
        AND: [
          { survey: { workspaceId: { in: workspaceIdsResult.data } } },
          { createdAt: { gte: usageCycleWindow.start, lt: usageCycleWindow.end } },
        ],
      },
    });

    // The result is an aggregation of the total count
    return ok(responseAggregations._count.id);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "organization", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
});
