"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { useTranslate } from "@tolgee/react";
import { TUserLocale } from "@formbricks/types/user";
import { InsightView } from "./insight-view";

interface InsightsCardProps {
  environmentId: string;
  insightsPerPage: number;
  projectName: string;
  statsFrom?: Date;
  documentsPerPage: number;
  locale: TUserLocale;
}

export const InsightsCard = ({
  statsFrom,
  environmentId,
  projectName,
  insightsPerPage: insightsLimit,
  documentsPerPage,
  locale,
}: InsightsCardProps) => {
  const { t } = useTranslate();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("environments.experience.insights_for_project", { projectName })}</CardTitle>
        <CardDescription>{t("environments.experience.insights_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <InsightView
          statsFrom={statsFrom}
          environmentId={environmentId}
          documentsPerPage={documentsPerPage}
          insightsPerPage={insightsLimit}
          locale={locale}
        />
      </CardContent>
    </Card>
  );
};
