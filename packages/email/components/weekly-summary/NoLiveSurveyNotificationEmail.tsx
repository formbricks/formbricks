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
