"use client";

import { Switch } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { toggleUserNotification } from "./actions";

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
      checked={notificationSettings[surveyId]?.responseFinished}
      onCheckedChange={async () => {
        await toggleUserNotification("responseFinished", surveyId, userId, notificationSettings);
        toast.success(`Every new submission is coming your way!`);
        router.refresh();
      }}
    />
  );
}
