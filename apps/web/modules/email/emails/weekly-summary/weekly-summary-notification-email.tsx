import { TFnType } from "@tolgee/react";
import React from "react";
import type { TWeeklySummaryNotificationResponse } from "@formbricks/types/weekly-summary";
import { EmailTemplate } from "../../components/email-template";
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
  t: TFnType;
}

export function WeeklySummaryNotificationEmail({
  notificationData,
  startDate,
  endDate,
  startYear,
  endYear,
  t,
}: WeeklySummaryNotificationEmailProps): React.JSX.Element {
  return (
    <EmailTemplate t={t}>
      <NotificationHeader
        endDate={endDate}
        endYear={endYear}
        projectName={notificationData.projectName}
        startDate={startDate}
        startYear={startYear}
      />
      <NotificationInsight insights={notificationData.insights} />
      <LiveSurveyNotification
        environmentId={notificationData.environmentId}
        surveys={notificationData.surveys}
      />
      <NotificationFooter environmentId={notificationData.environmentId} />
    </EmailTemplate>
  );
}
