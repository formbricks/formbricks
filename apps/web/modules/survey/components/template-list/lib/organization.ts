import { updateUser } from "@/modules/survey/components/template-list/lib/user";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserNotificationSettings } from "@formbricks/types/user";

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
