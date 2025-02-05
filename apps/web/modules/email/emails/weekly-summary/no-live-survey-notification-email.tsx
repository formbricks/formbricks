import React from "react";
import type { TWeeklySummaryNotificationResponse } from "@formbricks/types/weekly-summary";
import { CreateReminderNotificationBody } from "./create-reminder-notification-body";
import { NotificationHeader } from "./notification-header";

interface NoLiveSurveyNotificationEmailProps {
  notificationData: TWeeklySummaryNotificationResponse;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
}

export function NoLiveSurveyNotificationEmail({
  notificationData,
  startDate,
  endDate,
  startYear,
  endYear,
}: NoLiveSurveyNotificationEmailProps): React.JSX.Element {
  return (
    <div>
      <NotificationHeader
        endDate={endDate}
        endYear={endYear}
        projectName={notificationData.projectName}
        startDate={startDate}
        startYear={startYear}
      />
      <CreateReminderNotificationBody notificationData={notificationData} />
    </div>
  );
}
