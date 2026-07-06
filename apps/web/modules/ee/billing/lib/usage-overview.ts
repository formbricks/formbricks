import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export interface TBillingUsageOverview {
  surveyCount: number;
  memberCount: number;
}

// Aggregate counts shown in the redesigned "Usage Overview" billing card
// (a-b_billing_usage-subscription-redesign experiment). Surveys are workspace-scoped,
// so they are counted across every workspace in the org.
export const getBillingUsageOverview = reactCache(
  async (organizationId: string): Promise<TBillingUsageOverview> => {
    validateInputs([organizationId, ZId]);

    try {
      const [surveyCount, memberCount] = await Promise.all([
        prisma.survey.count({ where: { workspace: { organizationId } } }),
        prisma.membership.count({ where: { organizationId } }),
      ]);

      return { surveyCount, memberCount };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
