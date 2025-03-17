import { PostHog } from "posthog-node";
import { TOrganizationBillingPlan, TOrganizationBillingPlanLimits } from "@formbricks/types/organizations";
import { cache } from "./cache";
import { IS_POSTHOG_CONFIGURED, IS_PRODUCTION, POSTHOG_API_HOST, POSTHOG_API_KEY } from "./constants";

const enabled = IS_PRODUCTION && IS_POSTHOG_CONFIGURED;

export const capturePosthogEnvironmentEvent = async (
  environmentId: string,
  eventName: string,
  properties: any = {}
) => {
  if (!enabled || typeof POSTHOG_API_HOST !== "string" || typeof POSTHOG_API_KEY !== "string") {
    return;
  }
  try {
    const client = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_API_HOST,
    });
    client.capture({
      // workaround with a static string as exaplained in PostHog docs: https://posthog.com/docs/product-analytics/group-analytics
      distinctId: "environmentEvents",
      event: eventName,
      groups: { environment: environmentId },
      properties,
    });
    await client.shutdown();
  } catch (error) {
    console.error("error sending posthog event:", error);
  }
};

export const sendPlanLimitsReachedEventToPosthogWeekly = (
  environmentId: string,
  billing: {
    plan: TOrganizationBillingPlan;
    limits: TOrganizationBillingPlanLimits;
  }
): Promise<string> =>
  cache(
    async () => {
      try {
        await capturePosthogEnvironmentEvent(environmentId, "plan limit reached", {
          ...billing,
        });
        return "success";
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    [`sendPlanLimitsReachedEventToPosthogWeekly-${billing.plan}-${environmentId}`],
    {
      revalidate: 60 * 60 * 24 * 7, // 7 days
    }
  )();
