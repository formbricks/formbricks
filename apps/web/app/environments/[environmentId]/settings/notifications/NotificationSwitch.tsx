"use client";

import { Switch } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateNotificationSettings } from "./actions";
import { NotificationSettings } from "@formbricks/types/users";

interface NotificationSwitchProps {
  surveyOrProductId: string;
  userId: string;
  notificationSettings: NotificationSettings;
  notificationType: "alert" | "weeklySummary";
}

export function NotificationSwitch({
  surveyOrProductId,
  userId,
  notificationSettings,
  notificationType,
}: NotificationSwitchProps) {
  const router = useRouter();

  return (
    <Switch
      id="notification-switch"
      aria-label="toggle notification settings"
      checked={notificationSettings[notificationType][surveyOrProductId]}
      onCheckedChange={async () => {
        // update notificiation settings
        const updatedNotificationSettings = { ...notificationSettings };
        updatedNotificationSettings[notificationType][surveyOrProductId] =
          !updatedNotificationSettings[notificationType][surveyOrProductId];
        await updateNotificationSettings(userId, notificationSettings);
        toast.success(`Notification setting updated successfully`, { id: "notification-switch" });
        router.refresh();
      }}
    />
  );
}
