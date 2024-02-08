import { unstable_cache } from "next/cache";

import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { getTeamDetails } from "@formbricks/lib/teamDetail/service";

export const sendFreeLimitReachedEventToPosthogBiWeekly = async (
  environmentId: string,
  plan: "inAppSurvey" | "userTargeting"
): Promise<string> =>
  unstable_cache(
    async () => {
      const teamDetails = await getTeamDetails(environmentId);
      if (teamDetails?.teamOwnerId) {
        await capturePosthogEvent(teamDetails.teamOwnerId, "free limit reached", environmentId, {
          plan,
        });
      }
      return "success";
    },
    [`posthog-${plan}-limitReached-${environmentId}`],
    {
      revalidate: 60 * 60 * 24 * 15, // 15 days
    }
  )();
