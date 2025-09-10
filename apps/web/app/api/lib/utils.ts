import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMonthlyOrganizationResponseCount } from "@/lib/organization/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import { Organization } from "@prisma/client";
import { logger } from "@formbricks/logger";

export const handleBillingLimitsCheck = async (
  environmentId: string,
  organizationId: string,
  organizationBilling: Organization["billing"]
): Promise<void> => {
  if (!IS_FORMBRICKS_CLOUD) return;

  const responsesCount = await getMonthlyOrganizationResponseCount(organizationId);
  const responsesLimit = organizationBilling.limits.monthly.responses;

  if (responsesLimit && responsesCount >= responsesLimit) {
    try {
      await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
        plan: organizationBilling.plan,
        limits: {
          projects: null,
          monthly: {
            responses: responsesLimit,
            miu: null,
          },
        },
      });
    } catch (err) {
      // Log error but do not throw
      logger.error(err, "Error sending plan limits reached event to Posthog");
    }
  }
};
