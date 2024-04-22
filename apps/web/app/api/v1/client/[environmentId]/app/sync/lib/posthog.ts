import { unstable_cache } from "next/cache";

import { capturePosthogEnvironmentEvent } from "@formbricks/lib/posthogServer";

export const sendFreeLimitReachedEventToPosthogBiWeekly = async (
  environmentId: string,
  plan: "inAppSurvey" | "userTargeting"
): Promise<string> =>
  unstable_cache(
    async () => {
      await capturePosthogEnvironmentEvent(environmentId, "free limit reached", {
        plan,
      });
      return "success";
    },
    [`posthog-${plan}-limitReached-${environmentId}`],
    {
      revalidate: 60 * 60 * 24 * 15, // 15 days
    }
  )();
