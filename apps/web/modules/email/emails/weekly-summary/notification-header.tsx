import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { translateEmailText } from "../../lib/utils";

interface NotificationHeaderProps {
  projectName: string;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
  locale: string;
}

export function NotificationHeader({
  projectName,
  startDate,
  endDate,
  startYear,
  endYear,
  locale,
}: NotificationHeaderProps): React.JSX.Element {
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
          <Heading className="m-0">{translateEmailText("notification_header_hey", locale)}</Heading>
        </div>
        <div className="float-right">
          <Text className="m-0 text-right font-semibold">
            {translateEmailText("notification_header_weekly_report_for", locale)} {projectName}
          </Text>
          {getNotificationHeaderimePeriod()}
        </div>
      </div>
    </Container>
  );
}
