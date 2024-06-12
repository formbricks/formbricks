import { PostHog } from "posthog-node";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { cache } from "./cache";
import { env } from "./env";

const enabled =
  process.env.NODE_ENV === "production" &&
  env.NEXT_PUBLIC_POSTHOG_API_HOST &&
  env.NEXT_PUBLIC_POSTHOG_API_KEY;

export const capturePosthogEnvironmentEvent = async (
  environmentId: string,
  eventName: string,
  properties: any = {}
) => {
  if (
    !enabled ||
    typeof env.NEXT_PUBLIC_POSTHOG_API_HOST !== "string" ||
    typeof env.NEXT_PUBLIC_POSTHOG_API_KEY !== "string"
  ) {
    return;
  }
  try {
    const client = new PostHog(env.NEXT_PUBLIC_POSTHOG_API_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_API_HOST,
    });
    client.capture({
      distinctId: environmentId,
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
