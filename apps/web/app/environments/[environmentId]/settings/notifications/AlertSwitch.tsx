"use client";

import { Switch } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateNotificationSettings } from "./actions";
import { experimental_useOptimistic as useOptimistic } from "react";

interface AlertSwitchProps {
  surveyId: string;
  userId: string;
  notificationSettings: any;
}

export function AlertSwitch({ surveyId, userId, notificationSettings }: AlertSwitchProps) {
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    notificationSettings[surveyId]?.responseFinished,
    (_, newValue) => newValue
  );
  const router = useRouter();

  return (
    <Switch
      id="every-submission"
      aria-label="toggle every submission"
      checked={optimisticValue}
      onCheckedChange={async () => {
        // get new value
        const updatedNotificationSettings = { ...notificationSettings };
        updatedNotificationSettings[surveyId]["responseFinished"] =
          !updatedNotificationSettings[surveyId]["responseFinished"];
        // set optimistic value
        setOptimisticValue(true);
        // update db
        await updateNotificationSettings(userId, notificationSettings);
        toast.success(`Every new submission is coming your way!`);
        router.refresh();
      }}
    />
  );
}
