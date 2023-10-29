import { responses } from "@/app/lib/api/response";
import reportUsage from "@formbricks/ee/billing/api/report-usage";
import { priceLookupKeys } from "@formbricks/ee/billing/utils/products";
import { CRON_SECRET } from "@formbricks/lib/constants";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeamsWithPaidPlan,
} from "@formbricks/lib/team/service";
import { TTeam } from "@formbricks/types/teams";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

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
  let people = await getMonthlyActiveTeamPeopleCount(team.id);
  let responses = await getMonthlyTeamResponseCount(team.id);

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
