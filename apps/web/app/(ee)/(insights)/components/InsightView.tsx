"use client";

import { UserIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import formbricks from "@formbricks/js";
import { cn } from "@formbricks/lib/cn";
import { TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TInsight, TInsightCategory } from "@formbricks/types/insights";
import { Badge } from "@formbricks/ui/components/Badge";
import { InsightSheet } from "@formbricks/ui/components/InsightSheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@formbricks/ui/components/Tabs";

interface InsightViewProps {
  insights: TInsight[];
  questionId?: string;
  surveyId?: string;
  documentsFilter?: TDocumentFilterCriteria;
  isFetching?: boolean;
  documentsPerPage?: number;
}

export const InsightView = ({
  insights,
  questionId,
  surveyId,
  documentsFilter,
  isFetching,
  documentsPerPage,
}: InsightViewProps) => {
  const [isInsightSheetOpen, setIsInsightSheetOpen] = useState(true);
  const [localInsights, setLocalInsights] = useState<TInsight[]>(insights);
  const [currentInsight, setCurrentInsight] = useState<TInsight | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  const handleFeedback = (feedback: "positive" | "negative") => {
    formbricks.track("AI Insight Feedback", {
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

  const handleFilterSelect = useCallback(
    (filterValue: string) => {
      setActiveTab(filterValue);
      if (filterValue === "all") {
        setLocalInsights(insights);
      } else {
        setLocalInsights(
          insights.filter((insight) => insight.category === (filterValue as TInsightCategory))
        );
      }
    },
    [insights]
  );

  useEffect(() => {
    handleFilterSelect(activeTab);
  }, [insights]);

  return (
    <div className={cn("mt-2")}>
      <Tabs defaultValue="all" onValueChange={handleFilterSelect}>
        <TabsList className={cn("ml-2")}>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="complaint">Complaint</TabsTrigger>
          <TabsTrigger value="featureRequest">Feature Request</TabsTrigger>
          <TabsTrigger value="praise">Praise</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? null : insights.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-slate-500">
                      No insights found. Collect more survey responses or enable insights for your existing
                      surveys to get started.
                    </p>
                  </TableCell>
                </TableRow>
              ) : localInsights.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-slate-500">No insights found for this filter.</p>
                  </TableCell>
                </TableRow>
              ) : (
                localInsights.map((insight) => (
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
                        <Badge text="Feature Request" type="warning" size="tiny" />
                      ) : insight.category === "praise" ? (
                        <Badge text="Praise" type="success" size="tiny" />
                      ) : insight.category === "other" ? (
                        <Badge text="Other" type="gray" size="tiny" />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      <InsightSheet
        isOpen={isInsightSheetOpen}
        setIsOpen={setIsInsightSheetOpen}
        insight={currentInsight}
        surveyId={surveyId}
        questionId={questionId}
        handleFeedback={handleFeedback}
        documentsFilter={documentsFilter}
        documentsPerPage={documentsPerPage}
      />
    </div>
  );
};
