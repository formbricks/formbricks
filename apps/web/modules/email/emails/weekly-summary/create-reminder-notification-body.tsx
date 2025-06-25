import { WEBAPP_URL } from "@/lib/constants";
import { getTranslate } from "@/tolgee/server";
import { Container, Text } from "@react-email/components";
import React from "react";
import type { TWeeklySummaryNotificationResponse } from "@formbricks/types/weekly-summary";
import { EmailButton } from "../../components/email-button";
import { NotificationFooter } from "./notification-footer";

interface CreateReminderNotificationBodyProps {
  notificationData: TWeeklySummaryNotificationResponse;
}

export async function CreateReminderNotificationBody({
  notificationData,
}: CreateReminderNotificationBodyProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <Container>
      <Text>
        {t("emails.weekly_summary_create_reminder_notification_body_text", {
          projectName: notificationData.projectName,
        })}
      </Text>
      <Text className="pt-4 font-bold">
        {t("emails.weekly_summary_create_reminder_notification_body_dont_let_a_week_pass")}
      </Text>
      <EmailButton
        href={`${WEBAPP_URL}/environments/${notificationData.environmentId}/surveys?utm_source=weekly&utm_medium=email&utm_content=SetupANewSurveyCTA`}
        label={t("emails.weekly_summary_create_reminder_notification_body_setup_a_new_survey")}
      />
      <Text className="pt-4">
        {t("emails.weekly_summary_create_reminder_notification_body_need_help")}
        <a href="https://cal.com/johannes/15">
          {t("emails.weekly_summary_create_reminder_notification_body_cal_slot")}
        </a>
        {t("emails.weekly_summary_create_reminder_notification_body_reply_email")}
      </Text>
      <NotificationFooter environmentId={notificationData.environmentId} />
    </Container>
  );
}
