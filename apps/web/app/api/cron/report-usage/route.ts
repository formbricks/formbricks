import { responses } from "@/app/lib/api/response";
import { headers } from "next/headers";

import { ProductFeatureKeys } from "@formbricks/ee/billing/lib/constants";
import { reportUsageToStripe } from "@formbricks/ee/billing/lib/report-usage";
import { CRON_SECRET, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationsWithPaidPlan,
} from "@formbricks/lib/organization/service";
import { TOrganization } from "@formbricks/types/organizations";

const reportOrganizationUsage = async (organization: TOrganization) => {
  const stripeCustomerId = organization.billing.stripeCustomerId;
  if (!stripeCustomerId) {
    return;
  }

  if (!IS_FORMBRICKS_CLOUD) {
    return;
  }

  let calculateResponses =
    organization.billing.features.inAppSurvey.status !== "inactive" &&
    !organization.billing.features.inAppSurvey.unlimited;
  let calculatePeople =
    organization.billing.features.userTargeting.status !== "inactive" &&
    !organization.billing.features.userTargeting.unlimited;

  if (!calculatePeople && !calculateResponses) {
    return;
  }
  let people = await getMonthlyActiveOrganizationPeopleCount(organization.id);
  let responses = await getMonthlyOrganizationResponseCount(organization.id);

  if (calculatePeople) {
    await reportUsageToStripe(
      stripeCustomerId,
      people,
      ProductFeatureKeys.userTargeting,
      Math.floor(Date.now() / 1000)
    );
  }
  if (calculateResponses) {
    await reportUsageToStripe(
      stripeCustomerId,
      responses,
      ProductFeatureKeys.inAppSurvey,
      Math.floor(Date.now() / 1000)
    );
  }
};

export const POST = async (): Promise<Response> => {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey || apiKey !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  try {
    const organizationsWithPaidPlan = await getOrganizationsWithPaidPlan();
    await Promise.all(organizationsWithPaidPlan.map(reportOrganizationUsage));

    return responses.successResponse({}, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
