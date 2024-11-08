import { Column, Container, Row, Section, Text } from "@react-email/components";
import React from "react";
import type { TWeeklySummaryInsights } from "@formbricks/types/weekly-summary";
import { translateEmailText } from "../../lib/utils";

interface NotificationInsightProps {
  insights: TWeeklySummaryInsights;
  locale: string;
}

export function NotificationInsight({ insights, locale }: NotificationInsightProps): React.JSX.Element {
  return (
    <Container>
      <Section className="my-4 rounded-md bg-slate-100">
        <Row>
          <Column className="text-center">
            <Text className="text-sm">{translateEmailText("notification_insight_surveys", locale)}</Text>
            <Text className="text-lg font-bold">{insights.numLiveSurvey}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">{translateEmailText("notification_insight_displays", locale)}</Text>
            <Text className="text-lg font-bold">{insights.totalDisplays}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">{translateEmailText("notification_insight_responses", locale)}</Text>
            <Text className="text-lg font-bold">{insights.totalResponses}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">{translateEmailText("notification_insight_completed", locale)}</Text>
            <Text className="text-lg font-bold">{insights.totalCompletedResponses}</Text>
          </Column>
          {insights.totalDisplays !== 0 ? (
            <Column className="text-center">
              <Text className="text-sm">
                {translateEmailText("notification_insight_completion_rate", locale)}
              </Text>
              <Text className="text-lg font-bold">{Math.round(insights.completionRate)}%</Text>
            </Column>
          ) : (
            ""
          )}
        </Row>
      </Section>
    </Container>
  );
}
