"use client";

import { Switch } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateNotificationSettings } from "./actions";

interface AlertSwitchProps {
  surveyId: string;
  userId: string;
  notificationSettings: any;
  notificationType: string;
}

export function AlertSwitch({ surveyId, userId, notificationSettings, notificationType }: AlertSwitchProps) {
  const router = useRouter();

  return (
    <Switch
      id="every-submission"
      aria-label="toggle every submission"
      checked={notificationSettings[surveyId][notificationType]}
      onCheckedChange={async () => {
        // update notificiation settings
        const updatedNotificationSettings = { ...notificationSettings };
        updatedNotificationSettings[surveyId][notificationType] =
          !updatedNotificationSettings[surveyId][notificationType];
        // update db
        await updateNotificationSettings(userId, notificationSettings);
        // show success message if toggled on, different message if toggled off
        if (updatedNotificationSettings[surveyId]["responseFinished"] && notificationType == "responseFinished") {
          toast.success(`Every new response is coming your way.`);
        } else if (updatedNotificationSettings[surveyId]["weeklySummary"] && notificationType == "weeklySummary") {
          toast.success(`You have signed up for weekly email notification.`);
        } else if (notificationType == "responseFinished") {
            toast.success(`You won't receive notifications anymore.`);
        } else {
          toast.success(`You have signed off for weekly email notification`);
        }
      router.refresh();
      }}
    />
  );
}
