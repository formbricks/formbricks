"use client";

import { UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import formbricks from "@formbricks/js/app";
import { TInsight } from "@formbricks/types/insights";
import { Badge } from "@formbricks/ui/components/Badge";
import { InsightFilter } from "@formbricks/ui/components/InsightFilter";
import { InsightSheet } from "@formbricks/ui/components/InsightSheet";
import { Table, TableBody, TableCell, TableRow } from "@formbricks/ui/components/Table";

interface InsightViewProps {
  insights: TInsight[];
  questionId?: string;
  surveyId?: string;
}

export const InsightView = ({ insights, questionId, surveyId }: InsightViewProps) => {
  const [isInsightSheetOpen, setIsInsightSheetOpen] = useState(true);
  const [localInsights, setLocalInsights] = useState<TInsight[]>(insights);
  const [currentInsight, setCurrentInsight] = useState<TInsight | null>(null);

  useEffect(() => {
    setLocalInsights(insights);
  }, [insights]);

  const handleFeedback = (feedback: "positive" | "negative") => {
    formbricks.track("Insight Feedback", {
      hiddenFields: {
        feedbackSentiment: feedback,
        insightId: currentInsight?.id,
        insightTitle: currentInsight?.title,
        insightDescription: currentInsight?.description,
        insightCategory: currentInsight?.category,
        environmentId: currentInsight?.environmentId,
        surveyId,
        questionId,
      },
    });
  };

  return (
    <div>
      <InsightFilter insights={insights} setInsights={setLocalInsights} />
      <Table>
        <TableBody>
          {insights.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center">
                <p className="text-slate-500">No insights found.</p>
              </TableCell>
            </TableRow>
          ) : localInsights.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center">
                <p className="text-slate-500">No insights found for this filter.</p>
              </TableCell>
            </TableRow>
          ) : (
            insights.map((insight) => (
              <TableRow
                key={insight.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => {
                  setCurrentInsight(insight);
                  setIsInsightSheetOpen(true);
                }}>
                <TableCell className="flex font-medium">
                  {insight._count.documentInsights} <UserIcon className="ml-2 h-4 w-4" />
                </TableCell>
                <TableCell className="font-medium">{insight.title}</TableCell>
                <TableCell>{insight.description}</TableCell>
                <TableCell>
                  {insight.category === "complaint" ? (
                    <Badge text="Complaint" type="error" size="tiny" />
                  ) : insight.category === "featureRequest" ? (
                    <Badge text="Request" type="warning" size="tiny" />
                  ) : insight.category === "praise" ? (
                    <Badge text="Praise" type="success" size="tiny" />
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <InsightSheet
        isOpen={isInsightSheetOpen}
        setIsOpen={setIsInsightSheetOpen}
        insight={currentInsight}
        surveyId={surveyId}
        questionId={questionId}
        handleFeedback={handleFeedback}
      />
    </div>
  );
};
