import { getAllEnvironmentsFromOrganizationId } from "@/modules/api/management/responses/lib/project";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getOrganizationIdFromEnvironmentId = reactCache(async (environmentId: string) =>
  cache(
    async () => {
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
        throw new ResourceNotFoundError("Organization", null);
      }

      return organization.id;
    },
    [`management-getOrganizationIdFromEnvironmentId-${environmentId}`],
    {
      tags: [organizationCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);

export const getOrganizationBilling = reactCache(async (organizationId: string) =>
  cache(
    async () => {
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
          throw new ResourceNotFoundError("Organization", null);
        }

        return organization;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`management-getOrganizationBilling-${organizationId}`],
    {
      tags: [organizationCache.tag.byId(organizationId)],
    }
  )()
);

export const getMonthlyOrganizationResponseCount = reactCache(
  async (organizationId: string): Promise<number> =>
    cache(
      async () => {
        try {
          const organization = await getOrganizationBilling(organizationId);
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
          const environmentIds = await getAllEnvironmentsFromOrganizationId(organizationId);

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
      [`management-getMonthlyOrganizationResponseCount-${organizationId}`],
      {
        revalidate: 60 * 60 * 2, // 2 hours
      }
    )()
);
