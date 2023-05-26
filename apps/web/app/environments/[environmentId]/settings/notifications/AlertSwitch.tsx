"use client";

import { Switch } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateNotificationSettings } from "./actions";

interface AlertSwitchProps {
  surveyId: string;
  userId: string;
  notificationSettings: any;
}

export function AlertSwitch({ surveyId, userId, notificationSettings }: AlertSwitchProps) {
  const router = useRouter();

  return (
    <Switch
      id="every-submission"
      aria-label="toggle every submission"
      checked={notificationSettings[surveyId]["responseFinished"]}
      onCheckedChange={async () => {
        // update notificiation settings
        const updatedNotificationSettings = { ...notificationSettings };
        updatedNotificationSettings[surveyId]["responseFinished"] =
          !updatedNotificationSettings[surveyId]["responseFinished"];
        // update db
        await updateNotificationSettings(userId, notificationSettings);
        // show success message if toggled on, different message if toggled off
        if (updatedNotificationSettings[surveyId]["responseFinished"]) {
          toast.success(`Every new response is coming your way.`);
        } else {
          toast.success(`You won't receive notifications anymore.`);
        }
        router.refresh();
      }}
    />
  );
}
