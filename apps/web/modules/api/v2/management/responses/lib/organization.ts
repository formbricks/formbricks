import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { getBillingUsageCycleWindow } from "@/lib/utils/billing";
import { countOrganizationResponses } from "@/modules/organization/usage/lib/response-count";

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

export const getMonthlyOrganizationResponseCount = reactCache(async (organizationId: string) => {
  try {
    const billing = await getOrganizationBilling(organizationId);
    if (!billing.ok) {
      return err(billing.error);
    }

    const usageCycleWindow = getBillingUsageCycleWindow(billing.data);

    return ok(
      await countOrganizationResponses(organizationId, {
        gte: usageCycleWindow.start,
        lt: usageCycleWindow.end,
      })
    );
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "organization", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
});
