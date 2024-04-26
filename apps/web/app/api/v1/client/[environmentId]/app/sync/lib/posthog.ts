import { cache } from "@formbricks/lib/cache";
import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";

export const sendFreeLimitReachedEventToPosthogBiWeekly = (
  environmentId: string,
  plan: "inAppSurvey" | "userTargeting"
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
