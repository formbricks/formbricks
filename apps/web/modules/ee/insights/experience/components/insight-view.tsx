"use client";

import { InsightSheet } from "@/modules/ee/insights/components/insight-sheet";
import {
  TInsightFilterCriteria,
  TInsightWithDocumentCount,
} from "@/modules/ee/insights/experience/types/insights";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { InsightCategory } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { UserIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import formbricks from "@formbricks/js";
import { TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TUserLocale } from "@formbricks/types/user";
import { getEnvironmentInsightsAction } from "../actions";
import CategoryBadge from "./category-select";
import { InsightLoading } from "./insight-loading";

interface InsightViewProps {
  statsFrom?: Date;
  environmentId: string;
  documentsPerPage: number;
  insightsPerPage: number;
  locale: TUserLocale;
}

export const InsightView = ({
  statsFrom,
  environmentId,
  insightsPerPage,
  documentsPerPage,
  locale,
}: InsightViewProps) => {
  const { t } = useTranslate();
  const [insights, setInsights] = useState<TInsightWithDocumentCount[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isInsightSheetOpen, setIsInsightSheetOpen] = useState(false);
  const [currentInsight, setCurrentInsight] = useState<TInsightWithDocumentCount | null>(null);
  const [activeTab, setActiveTab] = useState<string>("featureRequest");

  const handleFeedback = (_feedback: "positive" | "negative") => {
    formbricks.track("AI Insight Feedback");
  };

  const insightsFilter: TInsightFilterCriteria = useMemo(
    () => ({
      documentCreatedAt: {
        min: statsFrom,
      },
      category: activeTab === "all" ? undefined : (activeTab as InsightCategory),
    }),
    [statsFrom, activeTab]
  );

  const documentsFilter: TDocumentFilterCriteria = useMemo(
    () => ({
      createdAt: {
        min: statsFrom,
      },
    }),
    [statsFrom]
  );

  useEffect(() => {
    const fetchInitialInsights = async () => {
      setIsFetching(true);
      setInsights([]);
      try {
        const res = await getEnvironmentInsightsAction({
          environmentId,
          limit: insightsPerPage,
          offset: 0,
          insightsFilter,
        });
        if (res?.data) {
          setInsights(res.data);
          setHasMore(res.data.length >= insightsPerPage);

          // Find the updated currentInsight based on its id
          const updatedCurrentInsight = res.data.find((insight) => insight.id === currentInsight?.id);

          // Update currentInsight with the matched insight or default to the first one
          setCurrentInsight(updatedCurrentInsight || (res.data.length > 0 ? res.data[0] : null));
        }
      } catch (error) {
        console.error("Failed to fetch insights:", error);
      } finally {
        setIsFetching(false); // Ensure isFetching is set to false in all cases
      }
    };

    fetchInitialInsights();
  }, [environmentId, insightsPerPage, insightsFilter]);

  const fetchNextPage = useCallback(async () => {
    if (!hasMore) return;
    setIsFetching(true);
    const res = await getEnvironmentInsightsAction({
      environmentId,
      limit: insightsPerPage,
      offset: insights.length,
      insightsFilter,
    });
    if (res?.data) {
      setInsights((prevInsights) => [...prevInsights, ...(res.data || [])]);
      setHasMore(res.data.length >= insightsPerPage);
      setIsFetching(false);
    }
  }, [environmentId, insights, insightsPerPage, insightsFilter, hasMore]);

  const handleFilterSelect = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div>
      <Tabs defaultValue="featureRequest" onValueChange={handleFilterSelect}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">{t("environments.experience.all")}</TabsTrigger>
            <TabsTrigger value="complaint">{t("environments.experience.complaint")}</TabsTrigger>
            <TabsTrigger value="featureRequest">{t("environments.experience.feature_request")}</TabsTrigger>
            <TabsTrigger value="praise">{t("environments.experience.praise")}</TabsTrigger>
            <TabsTrigger value="other">{t("common.other")}</TabsTrigger>
          </TabsList>
        </div>
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
              {insights.length === 0 && !isFetching ? (
                <TableRow className="pointer-events-none">
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-slate-500">{t("environments.experience.no_insights_found")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                insights
                  .sort((a, b) => b._count.documentInsights - a._count.documentInsights)
                  .map((insight) => (
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
                      <TableCell className="flex items-center justify-between gap-2">
                        <CategoryBadge category={insight.category} insightId={insight.id} />
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          {isFetching && <InsightLoading />}
        </TabsContent>
      </Tabs>

      {hasMore && !isFetching && (
        <div className="flex justify-center py-5">
          <Button onClick={fetchNextPage} variant="secondary" size="sm" loading={isFetching}>
            {t("common.load_more")}
          </Button>
        </div>
      )}

      <InsightSheet
        isOpen={isInsightSheetOpen}
        setIsOpen={setIsInsightSheetOpen}
        insight={currentInsight}
        handleFeedback={handleFeedback}
        documentsFilter={documentsFilter}
        documentsPerPage={documentsPerPage}
        locale={locale}
      />
    </div>
  );
};
