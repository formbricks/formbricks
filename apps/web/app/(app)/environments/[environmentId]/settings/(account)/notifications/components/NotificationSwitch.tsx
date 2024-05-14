"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { TUserNotificationSettings } from "@formbricks/types/user";
import { Switch } from "@formbricks/ui/Switch";

import { updateNotificationSettingsAction } from "../actions";

interface NotificationSwitchProps {
  surveyOrProductOrTeamId: string;
  notificationSettings: TUserNotificationSettings;
  notificationType: "alert" | "weeklySummary" | "unsubscribedTeamIds";
  autoDisableNotificationType?: string;
  autoDisableNotificationElementId?: string;
}

export const NotificationSwitch = ({
  surveyOrProductOrTeamId,
  notificationSettings,
  notificationType,
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: NotificationSwitchProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const isChecked =
    notificationType === "unsubscribedTeamIds"
      ? !notificationSettings.unsubscribedTeamIds?.includes(surveyOrProductOrTeamId)
      : notificationSettings[notificationType][surveyOrProductOrTeamId] === true;

  const handleSwitchChange = async () => {
    setIsLoading(true);

    let updatedNotificationSettings = { ...notificationSettings };
    if (notificationType === "unsubscribedTeamIds") {
      const unsubscribedTeamIds = updatedNotificationSettings.unsubscribedTeamIds ?? [];
      if (unsubscribedTeamIds.includes(surveyOrProductOrTeamId)) {
        updatedNotificationSettings.unsubscribedTeamIds = unsubscribedTeamIds.filter(
          (id) => id !== surveyOrProductOrTeamId
        );
      } else {
        updatedNotificationSettings.unsubscribedTeamIds = [...unsubscribedTeamIds, surveyOrProductOrTeamId];
      }
    } else {
      updatedNotificationSettings[notificationType][surveyOrProductOrTeamId] =
        !updatedNotificationSettings[notificationType][surveyOrProductOrTeamId];
    }

    await updateNotificationSettingsAction(updatedNotificationSettings);
    setIsLoading(false);
  };

  useEffect(() => {
    if (
      autoDisableNotificationType &&
      autoDisableNotificationElementId === surveyOrProductOrTeamId &&
      isChecked
    ) {
      switch (notificationType) {
        case "alert":
          if (notificationSettings[notificationType][surveyOrProductOrTeamId] === true) {
            handleSwitchChange();
            toast.success("You will not receive any more emails for responses on this survey!", {
              id: "notification-switch",
            });
          }
          break;

        case "unsubscribedTeamIds":
          if (!notificationSettings.unsubscribedTeamIds?.includes(surveyOrProductOrTeamId)) {
            handleSwitchChange();
            toast.success("You will not be auto-subscribed to this team's surveys anymore!", {
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
