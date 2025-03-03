import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import React from "react";

interface NotificationHeaderProps {
  projectName: string;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
}

export async function NotificationHeader({
  projectName,
  startDate,
  endDate,
  startYear,
  endYear,
}: NotificationHeaderProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  const getNotificationHeaderimePeriod = (): React.JSX.Element => {
    if (startYear === endYear) {
      return (
        <Text className="m-0 text-right">
          {startDate} - {endDate} {endYear}
        </Text>
      );
    }

    return (
      <Text className="m-0 text-right">
        {startDate} {startYear} - {endDate} {endYear}
      </Text>
    );
  };
  return (
    <Container>
      <div className="block px-0 py-4">
        <div className="float-left mt-2">
          <Heading className="m-0">{t("emails.notification_header_hey")}</Heading>
        </div>
        <div className="float-right">
          <Text className="m-0 text-right font-semibold">
            {t("emails.notification_header_weekly_report_for")} {projectName}
          </Text>
          {getNotificationHeaderimePeriod()}
        </div>
      </div>
    </Container>
  );
}
