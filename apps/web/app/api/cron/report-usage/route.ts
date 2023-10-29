import { responses } from "@/app/lib/api/response";
import reportUsage from "@formbricks/ee/billing/api/report-usage";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getTeamsWithPaidPlan } from "@formbricks/lib/team/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";
import { priceLookupKeys } from "@formbricks/ee/billing/utils/products";
import { getProducts } from "@formbricks/lib/product/service";
import { TTeam } from "@formbricks/types/teams";

async function reportTeamUsage(team: TTeam) {
  const stripeCustomerId = team.billing.stripeCustomerId;
  if (!stripeCustomerId) {
    return;
  }

  let calculateResponses = team.billing.features.appSurvey.status !== "inactive";
  let calculatePeople = team.billing.features.userTargeting.status !== "inactive";

  if (!calculatePeople && !calculateResponses) {
    return;
  }
  let people = 0;
  let responses = 0;

  const products = await getProducts(team.id);
  for (const product of products) {
    for (const environment of product.environments) {
      if (calculateResponses) {
        const responsesInThisEnvironment = await getMonthlyResponseCount(environment.id);
        responses += responsesInThisEnvironment;
      }
      if (calculatePeople) {
        const peopleInThisEnvironment = await getMonthlyActivePeopleCount(environment.id);
        people += peopleInThisEnvironment;
      }
    }
  }

  if (calculatePeople) {
    await reportUsage(stripeCustomerId, people, priceLookupKeys.userTargeting, Math.floor(Date.now() / 1000));
  }
  if (calculateResponses) {
    await reportUsage(
      stripeCustomerId,
      responses + 1000,
      priceLookupKeys.appSurvey,
      Math.floor(Date.now() / 1000)
    );
  }
}

export async function GET(): Promise<NextResponse> {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey || apiKey !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  try {
    const teamsWithPaidPlan = await getTeamsWithPaidPlan();
    await Promise.all(teamsWithPaidPlan.map(reportTeamUsage));

    return responses.successResponse({}, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
