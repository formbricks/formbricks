import { cache } from "@formbricks/lib/cache";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";
import { TOrganizationBillingPlan, TOrganizationBillingPlanLimits } from "@formbricks/types/organizations";

export const sendFreeLimitReachedEventToPosthogBiWeekly = (
  environmentId: string,
  plan: "inAppSurvey" | "userTargeting" | "websiteSurvey"
): Promise<string> =>
  cache(
    async () => {
      try {
        await capturePosthogEnvironmentEvent(environmentId, "free limit reached", {
          plan,
        });
        return "success";
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    [`sendFreeLimitReachedEventToPosthogBiWeekly-${plan}-${environmentId}`],
    {
      revalidate: 60 * 60 * 24 * 15, // 15 days
    }
  )();

export const sendPlanLimitsReachedEventToPosthogWeekly = (
  environmentId: string,
  meta: {
    plan: TOrganizationBillingPlan;
    limits?: {
      monthly?: {
        miu?: number;
        responses?: number;
      };
    };
  }
): Promise<string> =>
  cache(
    async () => {
      try {
        await capturePosthogEnvironmentEvent(environmentId, "plan limit reached", {
          ...meta,
        });
        return "success";
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    [`sendPlanLimitsReachedEventToPosthogWeekly-${meta.plan}-${environmentId}`],
    {
      revalidate: 60 * 60 * 24 * 7, // 7 days
    }
  )();
