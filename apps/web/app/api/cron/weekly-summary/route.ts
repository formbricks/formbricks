import { responses } from "@/app/lib/api/response";
import { headers } from "next/headers";

import { sendNoLiveSurveyNotificationEmail, sendWeeklySummaryNotificationEmail } from "@formbricks/email";
import { CRON_SECRET } from "@formbricks/lib/constants";

import { getNotificationResponse } from "./lib/notificationResponse";
import { getProductsByTeamId } from "./lib/product";
import { getTeamIds } from "./lib/team";

const BATCH_SIZE = 500;

export const POST = async (): Promise<Response> => {
  // Check authentication
  if (headers().get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const emailSendingPromises: Promise<void>[] = [];

  // Fetch all team IDs
  const teamIds = await getTeamIds();

  // Paginate through teams
  for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
    const batchedTeamIds = teamIds.slice(i, i + BATCH_SIZE);
    // Fetch products for batched teams asynchronously
    const batchedProductsPromises = batchedTeamIds.map((teamId) => getProductsByTeamId(teamId));

    const batchedProducts = await Promise.all(batchedProductsPromises);
    for (const products of batchedProducts) {
      for (const product of products) {
        const teamMembers = product.team.memberships;
        const teamMembersWithNotificationEnabled = teamMembers.filter(
          (member) =>
            member.user.notificationSettings?.weeklySummary &&
            member.user.notificationSettings.weeklySummary[product.id]
        );

        if (teamMembersWithNotificationEnabled.length === 0) continue;

        const notificationResponse = getNotificationResponse(product.environments[0], product.name);

        if (notificationResponse.insights.numLiveSurvey === 0) {
          for (const teamMember of teamMembersWithNotificationEnabled) {
            emailSendingPromises.push(
              sendNoLiveSurveyNotificationEmail(teamMember.user.email, notificationResponse)
            );
          }
          continue;
        }

        for (const teamMember of teamMembersWithNotificationEnabled) {
          emailSendingPromises.push(
            sendWeeklySummaryNotificationEmail(teamMember.user.email, notificationResponse)
          );
        }
      }
    }
  }

  await Promise.all(emailSendingPromises);
  return responses.successResponse({}, true);
};
