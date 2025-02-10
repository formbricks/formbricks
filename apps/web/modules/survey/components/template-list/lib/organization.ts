import { updateUser } from "@/modules/survey/components/template-list/lib/user";
import { Organization, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserNotificationSettings } from "@formbricks/types/user";

export const getOrganizationAIKeys = reactCache(
  async (organizationId: string): Promise<Pick<Organization, "isAIEnabled" | "billing"> | null> =>
    cache(
      async () => {
        try {
          const organization = await prisma.organization.findUnique({
            where: {
              id: organizationId,
            },
            select: {
              isAIEnabled: true,
              billing: true,
            },
          });
          return organization;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-template-list-getOrganizationAIKeys-${organizationId}`],
      {
        tags: [organizationCache.tag.byId(organizationId)],
      }
    )()
);

export const subscribeOrganizationMembersToSurveyResponses = async (
  surveyId: string,
  createdBy: string
): Promise<void> => {
  try {
    const surveyCreator = await prisma.user.findUnique({
      where: {
        id: createdBy,
      },
    });

    if (!surveyCreator) {
      throw new ResourceNotFoundError("User", createdBy);
    }

    const defaultSettings = { alert: {}, weeklySummary: {} };
    const updatedNotificationSettings: TUserNotificationSettings = {
      ...defaultSettings,
      ...surveyCreator.notificationSettings,
    };

    updatedNotificationSettings.alert[surveyId] = true;

    await updateUser(surveyCreator.id, {
      notificationSettings: updatedNotificationSettings,
    });
  } catch (error) {
    throw error;
  }
};
