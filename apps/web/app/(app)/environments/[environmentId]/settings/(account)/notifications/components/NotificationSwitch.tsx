"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { updateNotificationSettingsAction } from "../actions";

interface NotificationSwitchProps {
  surveyOrProjectOrOrganizationId: string;
  notificationSettings: TUserNotificationSettings;
  notificationType: "alert" | "weeklySummary" | "unsubscribedOrganizationIds";
  autoDisableNotificationType?: string;
  autoDisableNotificationElementId?: string;
}

export const NotificationSwitch = ({
  surveyOrProjectOrOrganizationId,
  notificationSettings,
  notificationType,
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: NotificationSwitchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslate();
  const router = useRouter();
  const isChecked =
    notificationType === "unsubscribedOrganizationIds"
      ? !notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrProjectOrOrganizationId)
      : notificationSettings[notificationType][surveyOrProjectOrOrganizationId] === true;

  const handleSwitchChange = async () => {
    setIsLoading(true);

    let updatedNotificationSettings = { ...notificationSettings };
    if (notificationType === "unsubscribedOrganizationIds") {
      const unsubscribedOrganizationIds = updatedNotificationSettings.unsubscribedOrganizationIds ?? [];
      if (unsubscribedOrganizationIds.includes(surveyOrProjectOrOrganizationId)) {
        updatedNotificationSettings.unsubscribedOrganizationIds = unsubscribedOrganizationIds.filter(
          (id) => id !== surveyOrProjectOrOrganizationId
        );
      } else {
        updatedNotificationSettings.unsubscribedOrganizationIds = [
          ...unsubscribedOrganizationIds,
          surveyOrProjectOrOrganizationId,
        ];
      }
    } else {
      updatedNotificationSettings[notificationType][surveyOrProjectOrOrganizationId] =
        !updatedNotificationSettings[notificationType][surveyOrProjectOrOrganizationId];
    }

    const updatedNotificationSettingsActionResponse = await updateNotificationSettingsAction({
      notificationSettings: updatedNotificationSettings,
    });
    if (updatedNotificationSettingsActionResponse?.data) {
      toast.success(t("environments.settings.notifications.notification_settings_updated"), {
        id: "notification-switch",
      });
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updatedNotificationSettingsActionResponse);
      toast.error(errorMessage, {
        id: "notification-switch",
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (
      autoDisableNotificationType &&
      autoDisableNotificationElementId === surveyOrProjectOrOrganizationId &&
      isChecked
    ) {
      switch (notificationType) {
        case "alert":
          if (notificationSettings[notificationType][surveyOrProjectOrOrganizationId] === true) {
            handleSwitchChange();
            toast.success(
              t(
                "environments.settings.notifications.you_will_not_receive_any_more_emails_for_responses_on_this_survey"
              ),
              {
                id: "notification-switch",
              }
            );
          }
          break;

        case "unsubscribedOrganizationIds":
          if (!notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrProjectOrOrganizationId)) {
            handleSwitchChange();
            toast.success(
              t(
                "environments.settings.notifications.you_will_not_be_auto_subscribed_to_this_organizations_surveys_anymore"
              ),
              {
                id: "notification-switch",
              }
            );
          }
          break;

        default:
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Switch
      id="notification-switch"
      aria-label={`toggle notification settings for ${notificationType}`}
      checked={isChecked}
      disabled={isLoading}
      onCheckedChange={async () => {
        await handleSwitchChange();
      }}
    />
  );
};
