import React from "react";

import { TNotificationResponse } from "@formbricks/types/weeklySummary";

import { CreateReminderNotificationBody } from "./CreateReminderNotificationBody";
import { NotificationHeader } from "./NotificationHeader";

interface NoLiveSurveyNotificationEmailProps {
  notificationData: TNotificationResponse;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
  WEBAPP_URL: string;
}

export const NoLiveSurveyNotificationEmail = ({
  notificationData,
  startDate,
  endDate,
  startYear,
  endYear,
  WEBAPP_URL,
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
      <CreateReminderNotificationBody webAppUrl={WEBAPP_URL} notificationData={notificationData} />
    </div>
  );
};
