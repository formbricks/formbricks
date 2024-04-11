import React from "react";

import { TNotificationResponse } from "@formbricks/types/weeklySummary";

import { LiveSurveyNotification } from "./LiveSurveyNotification";
import { NotificationFooter } from "./NotificationFooter";
import { NotificationHeader } from "./NotificationHeader";
import { NotificationInsight } from "./NotificationInsight";

interface WeeklySummaryNotificationEmailProps {
  notificationData: TNotificationResponse;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
  WEBAPP_URL: string;
}

export const WeeklySummaryNotificationEmail = ({
  notificationData,
  startDate,
  endDate,
  startYear,
  endYear,
  WEBAPP_URL,
}: WeeklySummaryNotificationEmailProps) => {
  return (
    <div>
      <NotificationHeader
        productName={notificationData.productName}
        startDate={startDate}
        endDate={endDate}
        startYear={startYear}
        endYear={endYear}
      />
      <NotificationInsight insights={notificationData.insights} />
      <LiveSurveyNotification
        webAppUrl={WEBAPP_URL}
        surveys={notificationData.surveys}
        environmentId={notificationData.environmentId}
      />
      <NotificationFooter webAppUrl={WEBAPP_URL} environmentId={notificationData.environmentId} />
    </div>
  );
};
