import { responses } from "@/app/lib/api/response";
import { sendNoLiveSurveyNotificationEmail, sendWeeklySummaryNotificationEmail } from "@/modules/email";
import { headers } from "next/headers";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getNotificationResponse } from "./lib/notificationResponse";
import { getOrganizationIds } from "./lib/organization";
import { getProductsByOrganizationId } from "./lib/product";

const BATCH_SIZE = 500;

export const POST = async (): Promise<Response> => {
  // Check authentication
  if (headers().get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const emailSendingPromises: Promise<void>[] = [];

  // Fetch all organization IDs
  const organizationIds = await getOrganizationIds();

  // Paginate through organizations
  for (let i = 0; i < organizationIds.length; i += BATCH_SIZE) {
    const batchedOrganizationIds = organizationIds.slice(i, i + BATCH_SIZE);
    // Fetch products for batched organizations asynchronously
    const batchedProductsPromises = batchedOrganizationIds.map((organizationId) =>
      getProductsByOrganizationId(organizationId)
    );

    const batchedProducts = await Promise.all(batchedProductsPromises);
    for (const products of batchedProducts) {
      for (const product of products) {
        const organizationMembers = product.organization.memberships;
        const organizationMembersWithNotificationEnabled = organizationMembers.filter(
          (member) =>
            member.user.notificationSettings?.weeklySummary &&
            member.user.notificationSettings.weeklySummary[product.id]
        );

        if (organizationMembersWithNotificationEnabled.length === 0) continue;

        const notificationResponse = getNotificationResponse(product.environments[0], product.name);

        if (notificationResponse.insights.numLiveSurvey === 0) {
          for (const organizationMember of organizationMembersWithNotificationEnabled) {
            if (await hasUserEnvironmentAccess(organizationMember.user.id, product.environments[0].id)) {
              emailSendingPromises.push(
                sendNoLiveSurveyNotificationEmail(
                  organizationMember.user.email,
                  notificationResponse,
                  organizationMember.user.locale
                )
              );
            }
          }
          continue;
        }

        for (const organizationMember of organizationMembersWithNotificationEnabled) {
          if (await hasUserEnvironmentAccess(organizationMember.user.id, product.environments[0].id)) {
            emailSendingPromises.push(
              sendWeeklySummaryNotificationEmail(
                organizationMember.user.email,
                notificationResponse,
                organizationMember.user.locale
              )
            );
          }
        }
      }
    }
  }

  await Promise.all(emailSendingPromises);
  return responses.successResponse({}, true);
};
