import { getTranslate } from "@/tolgee/server";
import { Column, Container, Row, Section, Text } from "@react-email/components";
import React from "react";
import type { TWeeklySummaryInsights } from "@formbricks/types/weekly-summary";

interface NotificationInsightProps {
  insights: TWeeklySummaryInsights;
}

export async function NotificationInsight({
  insights,
}: NotificationInsightProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <Container>
      <Section className="my-4 rounded-md bg-slate-100">
        <Row>
          <Column className="text-center">
            <Text className="text-sm">{t("emails.notification_insight_surveys")}</Text>
            <Text className="text-lg font-bold">{insights.numLiveSurvey}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">{t("emails.notification_insight_displays")}</Text>
            <Text className="text-lg font-bold">{insights.totalDisplays}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">{t("emails.notification_insight_responses")}</Text>
            <Text className="text-lg font-bold">{insights.totalResponses}</Text>
          </Column>
          <Column className="text-center">
            <Text className="text-sm">{t("emails.notification_insight_completed")}</Text>
            <Text className="text-lg font-bold">{insights.totalCompletedResponses}</Text>
          </Column>
          {insights.totalDisplays !== 0 ? (
            <Column className="text-center">
              <Text className="text-sm">{t("emails.notification_insight_completion_rate")}</Text>
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
