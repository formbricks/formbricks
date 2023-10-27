import { responses } from "@/app/lib/api/response";
import reportUsage from "@formbricks/ee/billing/api/report-usage";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getTeamsWithPaidPlan } from "@formbricks/lib/team/service";
import { getMonthlyDisplayCount } from "@formbricks/lib/display/service";

enum Metric {
  display,
  people,
}

export async function GET(): Promise<NextResponse> {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey || apiKey !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const teamsWithPaidPlan: any = await getTeamsWithPaidPlan();
    for (const team of teamsWithPaidPlan) {
      const stripeCustomerId = team.subscription.stripeCustomerId;
      if (!stripeCustomerId) {
        continue;
      }

      let people = 0;
      let displaysForTeam = 0;

      for (const product of team.products) {
        for (const environment of product.environments) {
          const peopleInThisEnvironment = await getMonthlyActivePeopleCount(environment.id);
          const displaysInThisEnvironment = await getMonthlyDisplayCount(environment.id);

          people += peopleInThisEnvironment;
          displaysForTeam += displaysInThisEnvironment;
        }
      }

      await reportUsage(stripeCustomerId, people, Metric.people, Math.floor(Date.now() / 1000));
      await reportUsage(stripeCustomerId, displaysForTeam, Metric.display, Math.floor(Date.now() / 1000));
    }

    return responses.successResponse({}, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
