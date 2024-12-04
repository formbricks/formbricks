import { Container, Text } from "@react-email/components";
import React from "react";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import type { TWeeklySummaryNotificationResponse } from "@formbricks/types/weekly-summary";
import { EmailButton } from "../../components/email-button";
import { translateEmailText } from "../../lib/utils";
import { NotificationFooter } from "./notification-footer";

interface CreateReminderNotificationBodyProps {
  notificationData: TWeeklySummaryNotificationResponse;
  locale: string;
}

export function CreateReminderNotificationBody({
  notificationData,
  locale,
}: CreateReminderNotificationBodyProps): React.JSX.Element {
  return (
    <Container>
      <Text>
        {translateEmailText("weekly_summary_create_reminder_notification_body_text", locale, {
          projectName: notificationData.projectName,
        })}
      </Text>
      <Text className="pt-4 font-bold">
        {translateEmailText("weekly_summary_create_reminder_notification_body_dont_let_a_week_pass", locale)}
      </Text>
      <EmailButton
        href={`${WEBAPP_URL}/environments/${notificationData.environmentId}/surveys?utm_source=weekly&utm_medium=email&utm_content=SetupANewSurveyCTA`}
        label={translateEmailText(
          "weekly_summary_create_reminder_notification_body_setup_a_new_survey",
          locale
        )}
      />
      <Text className="pt-4">
        {translateEmailText("weekly_summary_create_reminder_notification_body_need_help", locale)}
        <a href="https://cal.com/johannes/15">
          {translateEmailText("weekly_summary_create_reminder_notification_body_cal_slot", locale)}
        </a>
        {translateEmailText("weekly_summary_create_reminder_notification_body_reply_email", locale)}
      </Text>
      <NotificationFooter environmentId={notificationData.environmentId} locale={locale} />
    </Container>
  );
}
