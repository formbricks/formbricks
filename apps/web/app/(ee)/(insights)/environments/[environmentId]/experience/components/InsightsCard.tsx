"use client";

import { useMemo } from "react";
import { TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TInsightFilterCriteria } from "@formbricks/types/insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import { InsightLoading } from "./InsightLoading";
import { InsightView } from "./InsightView";

interface InsightsCardProps {
  environmentId: string;
  insightsPerPage: number;
  productName: string;
  statsFrom?: Date;
  documentsPerPage: number;
}

export const InsightsCard = ({
  statsFrom,
  environmentId,
  productName,
  insightsPerPage: insightsLimit,
  documentsPerPage,
}: InsightsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights for {productName}</CardTitle>
        <CardDescription>All the insights generated from responses across all your surveys</CardDescription>
      </CardHeader>
      <CardContent>
        <InsightView
          statsFrom={statsFrom}
          environmentId={environmentId}
          documentsPerPage={documentsPerPage}
          insightsPerPage={insightsLimit}
        />
      </CardContent>
    </Card>
  );
};
