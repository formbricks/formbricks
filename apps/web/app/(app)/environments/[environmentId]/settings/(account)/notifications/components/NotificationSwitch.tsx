"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { Switch } from "@formbricks/ui/Switch";
import { updateNotificationSettingsAction } from "../actions";

interface NotificationSwitchProps {
  surveyOrProductOrOrganizationId: string;
  notificationSettings: TUserNotificationSettings;
  notificationType: "alert" | "weeklySummary" | "unsubscribedOrganizationIds";
  autoDisableNotificationType?: string;
  autoDisableNotificationElementId?: string;
}

export const NotificationSwitch = ({
  surveyOrProductOrOrganizationId,
  notificationSettings,
  notificationType,
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: NotificationSwitchProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const isChecked =
    notificationType === "unsubscribedOrganizationIds"
      ? !notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrProductOrOrganizationId)
      : notificationSettings[notificationType][surveyOrProductOrOrganizationId] === true;

  const handleSwitchChange = async () => {
    setIsLoading(true);

    let updatedNotificationSettings = { ...notificationSettings };
    if (notificationType === "unsubscribedOrganizationIds") {
      const unsubscribedOrganizationIds = updatedNotificationSettings.unsubscribedOrganizationIds ?? [];
      if (unsubscribedOrganizationIds.includes(surveyOrProductOrOrganizationId)) {
        updatedNotificationSettings.unsubscribedOrganizationIds = unsubscribedOrganizationIds.filter(
          (id) => id !== surveyOrProductOrOrganizationId
        );
      } else {
        updatedNotificationSettings.unsubscribedOrganizationIds = [
          ...unsubscribedOrganizationIds,
          surveyOrProductOrOrganizationId,
        ];
      }
    } else {
      updatedNotificationSettings[notificationType][surveyOrProductOrOrganizationId] =
        !updatedNotificationSettings[notificationType][surveyOrProductOrOrganizationId];
    }

    await updateNotificationSettingsAction({ notificationSettings: updatedNotificationSettings });
    setIsLoading(false);
  };

  useEffect(() => {
    if (
      autoDisableNotificationType &&
      autoDisableNotificationElementId === surveyOrProductOrOrganizationId &&
      isChecked
    ) {
      switch (notificationType) {
        case "alert":
          if (notificationSettings[notificationType][surveyOrProductOrOrganizationId] === true) {
            handleSwitchChange();
            toast.success("You will not receive any more emails for responses on this survey!", {
              id: "notification-switch",
            });
          }
          break;

        case "unsubscribedOrganizationIds":
          if (!notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrProductOrOrganizationId)) {
            handleSwitchChange();
            toast.success("You will not be auto-subscribed to this organization's surveys anymore!", {
              id: "notification-switch",
            });
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
        toast.success("Notification settings updated", { id: "notification-switch" });
      }}
    />
  );
};
