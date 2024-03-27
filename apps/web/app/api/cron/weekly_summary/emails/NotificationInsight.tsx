import { Column, Container, Row, Section, Text } from "@react-email/components";
import React from "react";

export const NotificationInsight = ({ insights }) => {
  return (
    <Container>
      <Section className="my-4 rounded-md bg-slate-100">
        <Row>
          <Column className="text-center">
            <Text className="text-sm">Surveys</Text>
            <Text className="font-bold">{insights.numLiveSurvey}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">Displays</Text>
            <Text className="font-bold">{insights.totalDisplays}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">Responses</Text>
            <Text className="font-bold">{insights.totalResponses}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">Completed</Text>
            <Text className="font-bold">{insights.totalCompletedResponses}</Text>
          </Column>
          {insights.totalDisplays !== 0 ? (
            <Column className="text-center">
              <Text className="text-sm">Completion %</Text>
              <Text className="font-bold">{Math.round(insights.completionRate)}%</Text>
            </Column>
          ) : (
            ""
          )}
        </Row>
      </Section>
    </Container>
  );
};
