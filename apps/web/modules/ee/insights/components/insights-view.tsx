"use client";

import { InsightSheet } from "@/modules/ee/insights/components/insight-sheet";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { Insight, InsightCategory } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { UserIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import formbricks from "@formbricks/js";
import { cn } from "@formbricks/lib/cn";
import { TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TSurveyQuestionSummaryOpenText } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import CategoryBadge from "../experience/components/category-select";

interface InsightViewProps {
  insights: TSurveyQuestionSummaryOpenText["insights"];
  questionId?: string;
  surveyId?: string;
  documentsFilter?: TDocumentFilterCriteria;
  isFetching?: boolean;
  documentsPerPage?: number;
  locale: TUserLocale;
}

export const InsightView = ({
  insights,
  questionId,
  surveyId,
  documentsFilter,
  isFetching,
  documentsPerPage,
  locale,
}: InsightViewProps) => {
  const { t } = useTranslate();
  const [isInsightSheetOpen, setIsInsightSheetOpen] = useState(true);
  const [localInsights, setLocalInsights] = useState<TSurveyQuestionSummaryOpenText["insights"]>(insights);
  const [currentInsight, setCurrentInsight] = useState<
    TSurveyQuestionSummaryOpenText["insights"][number] | null
  >(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [visibleInsights, setVisibleInsights] = useState(10);

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
        setLocalInsights(insights.filter((insight) => insight.category === (filterValue as InsightCategory)));
      }
    },
    [insights]
  );

  useEffect(() => {
    handleFilterSelect(activeTab);

    // Update currentInsight if it exists in the new insights array
    if (currentInsight) {
      const updatedInsight = insights.find((insight) => insight.id === currentInsight.id);
      if (updatedInsight) {
        setCurrentInsight(updatedInsight);
      } else {
        setCurrentInsight(null);
        setIsInsightSheetOpen(false);
      }
    }
  }, [insights, activeTab, handleFilterSelect]);

  const handleLoadMore = () => {
    setVisibleInsights((prevVisibleInsights) => Math.min(prevVisibleInsights + 10, insights.length));
  };

  const updateLocalInsight = (insightId: string, updates: Partial<Insight>) => {
    setLocalInsights((prevInsights) =>
      prevInsights.map((insight) => (insight.id === insightId ? { ...insight, ...updates } : insight))
    );
  };

  const onCategoryChange = async (insightId: string, newCategory: InsightCategory) => {
    updateLocalInsight(insightId, { category: newCategory });
  };

  return (
    <div className={cn("mt-2")}>
      <Tabs defaultValue="all" onValueChange={handleFilterSelect}>
        <TabsList className={cn("ml-2")}>
          <TabsTrigger value="all">{t("environments.experience.all")}</TabsTrigger>
          <TabsTrigger value="complaint">{t("environments.experience.complaint")}</TabsTrigger>
          <TabsTrigger value="featureRequest">{t("environments.experience.feature_request")}</TabsTrigger>
          <TabsTrigger value="praise">{t("environments.experience.praise")}</TabsTrigger>
          <TabsTrigger value="other">{t("common.other")}</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>{t("common.title")}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
                <TableHead>{t("environments.experience.category")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? null : insights.length === 0 ? (
                <TableRow className="pointer-events-none">
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-slate-500">{t("environments.experience.no_insights_found")}</p>
                  </TableCell>
                </TableRow>
              ) : localInsights.length === 0 ? (
                <TableRow className="pointer-events-none">
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-slate-500">
                      {t("environments.experience.no_insights_for_this_filter")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                localInsights.slice(0, visibleInsights).map((insight) => (
                  <TableRow
                    key={insight.id}
                    className="group cursor-pointer hover:bg-slate-50"
                    onClick={() => {
                      setCurrentInsight(insight);
                      setIsInsightSheetOpen(true);
                    }}>
                    <TableCell className="flex font-medium">
                      {insight._count.documentInsights} <UserIcon className="ml-2 h-4 w-4" />
                    </TableCell>
                    <TableCell className="font-medium">{insight.title}</TableCell>
                    <TableCell className="underline-offset-2 group-hover:underline">
                      {insight.description}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge
                        category={insight.category}
                        insightId={insight.id}
                        onCategoryChange={onCategoryChange}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {visibleInsights < localInsights.length && (
        <div className="flex justify-center py-4">
          <Button onClick={handleLoadMore} variant="secondary" size="sm">
            {t("common.load_more")}
          </Button>
        </div>
      )}

      <InsightSheet
        isOpen={isInsightSheetOpen}
        setIsOpen={setIsInsightSheetOpen}
        insight={currentInsight}
        surveyId={surveyId}
        questionId={questionId}
        handleFeedback={handleFeedback}
        documentsFilter={documentsFilter}
        documentsPerPage={documentsPerPage}
        locale={locale}
      />
    </div>
  );
};
