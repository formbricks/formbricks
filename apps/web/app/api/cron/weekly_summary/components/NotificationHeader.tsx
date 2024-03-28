import { Container, Heading, Text } from "@react-email/components";
import React from "react";

interface NotificationHeaderProps {
  productName: string;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
}

export const NotificationHeader = ({
  productName,
  startDate,
  endDate,
  startYear,
  endYear,
}: NotificationHeaderProps) => {
  const getNotificationHeaderimePeriod = (
    startDate: string,
    endDate: string,
    startYear: number,
    endYear: number
  ) => {
    if (startYear == endYear) {
      return (
        <Text className="m-0 text-right">
          {startDate} - {endDate} {endYear}
        </Text>
      );
    } else {
      return (
        <Text className="m-0 text-right">
          {startDate} {startYear} - {endDate} {endYear}
        </Text>
      );
    }
  };
  return (
    <Container>
      <div className="block px-0 py-4">
        <div className="float-left mt-2">
          <Heading className="m-0">Hey 👋</Heading>
        </div>
        <div className="float-right">
          <Text className="m-0 text-right font-semibold">Weekly Report for {productName}</Text>
          {getNotificationHeaderimePeriod(startDate, endDate, startYear, endYear)}
        </div>
      </div>
    </Container>
  );
};
