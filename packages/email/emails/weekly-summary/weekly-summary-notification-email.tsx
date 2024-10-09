import React from "react";
import type { TWeeklySummaryNotificationResponse } from "@formbricks/types/weekly-summary";
import { LiveSurveyNotification } from "./live-survey-notification";
import { NotificationFooter } from "./notification-footer";
import { NotificationHeader } from "./notification-header";
import { NotificationInsight } from "./notification-insight";

interface WeeklySummaryNotificationEmailProps {
  notificationData: TWeeklySummaryNotificationResponse;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
}

export function WeeklySummaryNotificationEmail({
  notificationData,
  startDate,
  endDate,
  startYear,
  endYear,
}: WeeklySummaryNotificationEmailProps): React.JSX.Element {
  return (
    <div>
      <NotificationHeader
        endDate={endDate}
        endYear={endYear}
        productName={notificationData.productName}
        startDate={startDate}
        startYear={startYear}
      />
      <NotificationInsight insights={notificationData.insights} />
      <LiveSurveyNotification
        environmentId={notificationData.environmentId}
        surveys={notificationData.surveys}
      />
      <NotificationFooter environmentId={notificationData.environmentId} />
    </div>
  );
}
