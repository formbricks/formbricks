import { Container, Text } from "@react-email/components";
import React from "react";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import type { TWeeklySummaryNotificationResponse } from "@formbricks/types/weekly-summary";
import { EmailButton } from "../general/email-button";
import { NotificationFooter } from "./notification-footer";

interface CreateReminderNotificationBodyProps {
  notificationData: TWeeklySummaryNotificationResponse;
}

export function CreateReminderNotificationBody({
  notificationData,
}: CreateReminderNotificationBodyProps): React.JSX.Element {
  return (
    <Container>
      <Text>
        We’d love to send you a Weekly Summary, but currently there are no surveys running for
        {notificationData.productName}.
      </Text>
      <Text className="pt-4 font-bold">Don’t let a week pass without learning about your users:</Text>
      <EmailButton
        href={`${WEBAPP_URL}/environments/${notificationData.environmentId}/surveys?utm_source=weekly&utm_medium=email&utm_content=SetupANewSurveyCTA`}
        label="Setup a new survey"
      />
      <Text className="pt-4">
        Need help finding the right survey for your product? Pick a 15-minute slot{" "}
        <a href="https://cal.com/johannes/15">in our CEOs calendar</a> or reply to this email :)
      </Text>
      <NotificationFooter environmentId={notificationData.environmentId} />
    </Container>
  );
}
