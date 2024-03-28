import { CreateReminderNotificationBody } from "@/app/api/cron/weekly_summary/components/CreateReminderNotificationBody";
import { LiveSurveyNotification } from "@/app/api/cron/weekly_summary/components/LiveSurveyNotification";
import { NotificationFooter } from "@/app/api/cron/weekly_summary/components/NotificationFooter";
import { NotificationHeader } from "@/app/api/cron/weekly_summary/components/NotificationHeader";
import { NotificationInsight } from "@/app/api/cron/weekly_summary/components/NotificationInsight";
import { render } from "@react-email/render";

import { WEBAPP_URL } from "@formbricks/lib/constants";
import { EmailTemplate } from "@formbricks/lib/emails/EmailTemplate";
import { sendEmail } from "@formbricks/lib/emails/emails";

import { TNotificationResponse } from "./types";

const getEmailSubject = (productName: string): string => {
  return `${productName} User Insights - Last Week by Formbricks`;
};

export const sendWeeklySummaryNotificationEmail = async (
  email: string,
  notificationData: TNotificationResponse
) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const startDate = `${notificationData.lastWeekDate.getDate()} ${
    monthNames[notificationData.lastWeekDate.getMonth()]
  }`;
  const endDate = `${notificationData.currentDate.getDate()} ${
    monthNames[notificationData.currentDate.getMonth()]
  }`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.productName),
    html: render(
      <EmailTemplate
        content={
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
              WEBAPP_URL={WEBAPP_URL}
              surveys={notificationData.surveys}
              environmentId={notificationData.environmentId}
            />
            <NotificationFooter WEBAPP_URL={WEBAPP_URL} environmentId={notificationData.environmentId} />
          </div>
        }
      />
    ),
  });
};

export const sendNoLiveSurveyNotificationEmail = async (
  email: string,
  notificationData: TNotificationResponse
) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const startDate = `${notificationData.lastWeekDate.getDate()} ${
    monthNames[notificationData.lastWeekDate.getMonth()]
  }`;
  const endDate = `${notificationData.currentDate.getDate()} ${
    monthNames[notificationData.currentDate.getMonth()]
  }`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.productName),
    html: render(
      <EmailTemplate
        content={
          <div>
            <NotificationHeader
              productName={notificationData.productName}
              startDate={startDate}
              endDate={endDate}
              startYear={startYear}
              endYear={endYear}
            />
            <CreateReminderNotificationBody WEBAPP_URL={WEBAPP_URL} notificationData={notificationData} />
          </div>
        }
      />
    ),
  });
};
