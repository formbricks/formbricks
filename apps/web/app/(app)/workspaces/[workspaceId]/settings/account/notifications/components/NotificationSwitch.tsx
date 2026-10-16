"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Switch } from "@/modules/ui/components/switch";
import { useUpdateNotificationSetting } from "../hooks/use-notification-settings";

interface NotificationSwitchProps {
  surveyOrWorkspaceOrOrganizationId: string;
  notificationSettings: TUserNotificationSettings;
  notificationType: "alert" | "unsubscribedOrganizationIds";
  autoDisableNotificationType?: string;
  autoDisableNotificationElementId?: string;
}

export const NotificationSwitch = ({
  surveyOrWorkspaceOrOrganizationId,
  notificationSettings,
  notificationType,
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: NotificationSwitchProps) => {
  const { t } = useTranslation();
  const updateSetting = useUpdateNotificationSetting();
  const isChecked =
    notificationType === "unsubscribedOrganizationIds"
      ? !notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrWorkspaceOrOrganizationId)
      : notificationSettings[notificationType]?.[surveyOrWorkspaceOrOrganizationId] === true;

  const handleSwitchChange = async () => {
    // One switch, flipped from what is shown; the server applies it to the stored settings.
    const toggle =
      notificationType === "unsubscribedOrganizationIds"
        ? {
            type: "organizationEmails" as const,
            organizationId: surveyOrWorkspaceOrOrganizationId,
            subscribed: !isChecked,
          }
        : { type: "alert" as const, surveyId: surveyOrWorkspaceOrOrganizationId, enabled: !isChecked };

    try {
      await updateSetting.mutateAsync(toggle);
      toast.success(t("workspace.settings.notifications.notification_settings_updated"), {
        id: "notification-switch",
      });
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")), {
        id: "notification-switch",
      });
    }
  };

  useEffect(() => {
    if (
      autoDisableNotificationType &&
      autoDisableNotificationElementId === surveyOrWorkspaceOrOrganizationId &&
      isChecked
    ) {
      switch (notificationType) {
        case "alert":
          if (notificationSettings[notificationType]?.[surveyOrWorkspaceOrOrganizationId] === true) {
            handleSwitchChange();
            toast.success(
              t(
                "workspace.settings.notifications.you_will_not_receive_any_more_emails_for_responses_on_this_survey"
              ),
              {
                id: "notification-switch",
              }
            );
          }
          break;

        case "unsubscribedOrganizationIds":
          if (
            !notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrWorkspaceOrOrganizationId)
          ) {
            handleSwitchChange();
            toast.success(
              t(
                "workspace.settings.notifications.you_will_not_be_auto_subscribed_to_this_organizations_surveys_anymore"
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; re-running would re-fire the switch change and toast
  }, []);

  return (
    <Switch
      id="notification-switch"
      aria-label={`toggle notification settings for ${notificationType}`}
      checked={isChecked}
      disabled={updateSetting.isPending}
      onCheckedChange={async () => {
        await handleSwitchChange();
      }}
    />
  );
};
