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
  locale: string;
}

export function WeeklySummaryNotificationEmail({
  notificationData,
  startDate,
  endDate,
  startYear,
  endYear,
  locale,
}: WeeklySummaryNotificationEmailProps): React.JSX.Element {
  return (
    <EmailTemplate locale={locale}>
      <NotificationHeader
        endDate={endDate}
        endYear={endYear}
        projectName={notificationData.projectName}
        startDate={startDate}
        startYear={startYear}
        locale={locale}
      />
      <NotificationInsight insights={notificationData.insights} locale={locale} />
      <LiveSurveyNotification
        environmentId={notificationData.environmentId}
        surveys={notificationData.surveys}
        locale={locale}
      />
      <NotificationFooter environmentId={notificationData.environmentId} locale={locale} />
    </EmailTemplate>
  );
}
