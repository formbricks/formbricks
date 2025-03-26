import { responses } from "@/app/lib/api/response";
import { sendNoLiveSurveyNotificationEmail, sendWeeklySummaryNotificationEmail } from "@/modules/email";
import { headers } from "next/headers";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getNotificationResponse } from "./lib/notificationResponse";
import { getOrganizationIds } from "./lib/organization";
import { getProjectsByOrganizationId } from "./lib/project";

const BATCH_SIZE = 500;

export const POST = async (): Promise<Response> => {
  const headersList = await headers();
  // Check authentication
  if (headersList.get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const emailSendingPromises: Promise<void>[] = [];

  // Fetch all organization IDs
  const organizationIds = await getOrganizationIds();

  // Paginate through organizations
  for (let i = 0; i < organizationIds.length; i += BATCH_SIZE) {
    const batchedOrganizationIds = organizationIds.slice(i, i + BATCH_SIZE);
    // Fetch projects for batched organizations asynchronously
    const batchedProjectsPromises = batchedOrganizationIds.map((organizationId) =>
      getProjectsByOrganizationId(organizationId)
    );

    const batchedProjects = await Promise.all(batchedProjectsPromises);
    for (const projects of batchedProjects) {
      for (const project of projects) {
        const organizationMembers = project.organization.memberships;
        const organizationMembersWithNotificationEnabled = organizationMembers.filter(
          (member) =>
            member.user.notificationSettings?.weeklySummary &&
            member.user.notificationSettings.weeklySummary[project.id]
        );

        if (organizationMembersWithNotificationEnabled.length === 0) continue;

        const notificationResponse = getNotificationResponse(project.environments[0], project.name);

        if (notificationResponse.insights.numLiveSurvey === 0) {
          for (const organizationMember of organizationMembersWithNotificationEnabled) {
            if (await hasUserEnvironmentAccess(organizationMember.user.id, project.environments[0].id)) {
              emailSendingPromises.push(
                sendNoLiveSurveyNotificationEmail(organizationMember.user.email, notificationResponse)
              );
            }
          }
          continue;
        }

        for (const organizationMember of organizationMembersWithNotificationEnabled) {
          if (
            project.environments?.length > 0 &&
            (await hasUserEnvironmentAccess(organizationMember.user.id, project.environments[0].id))
          ) {
            emailSendingPromises.push(
              sendWeeklySummaryNotificationEmail(organizationMember.user.email, notificationResponse)
            );
          }
        }
      }
    }
  }

  await Promise.all(emailSendingPromises);
  return responses.successResponse({}, true);
};
