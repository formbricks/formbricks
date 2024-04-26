import React from "react";

import { TWeeklySummaryNotificationResponse } from "@formbricks/types/weeklySummary";

import { CreateReminderNotificationBody } from "./CreateReminderNotificationBody";
import { NotificationHeader } from "./NotificationHeader";

interface NoLiveSurveyNotificationEmailProps {
  notificationData: TWeeklySummaryNotificationResponse;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
}

export const NoLiveSurveyNotificationEmail = ({
  notificationData,
  startDate,
  endDate,
  startYear,
  endYear,
}: NoLiveSurveyNotificationEmailProps) => {
  return (
    <div>
      <NotificationHeader
        productName={notificationData.productName}
        startDate={startDate}
        endDate={endDate}
        startYear={startYear}
        endYear={endYear}
      />
      <CreateReminderNotificationBody notificationData={notificationData} />
    </div>
  );
};
