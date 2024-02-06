import { unstable_cache } from "next/cache";

import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { getTeamDetails } from "@formbricks/lib/teamDetail/service";

export const sendFreeLimitReachedEventToPosthogBiWeekly = async (
  environmentId: string,
  plan: "inAppSurvey" | "userTargeting"
) => {
  await unstable_cache(
    async () => {
      const teamDetails = await getTeamDetails(environmentId);
      if (teamDetails?.teamOwnerId) {
        return await capturePosthogEvent(teamDetails.teamOwnerId, "free limit reached", teamDetails.teamId, {
          plan,
        });
      }
    },
    [`posthog-${plan}-limitReached-${environmentId}`],
    {
      revalidate: 60 * 60 * 24 * 15, // 15 days
    }
  )();
};
