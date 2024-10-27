"use client";

import { InsightSheet } from "@/modules/ee/insights/components/insight-sheet";
import { ArchiveIcon, ArchiveRestoreIcon, UserIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import formbricks from "@formbricks/js";
import { TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TInsight, TInsightFilterCriteria } from "@formbricks/types/insights";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Switch } from "@formbricks/ui/components/Switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@formbricks/ui/components/Tabs";
import { getEnvironmentInsightsAction, updateInsightAction } from "../actions";
import CategoryBadge from "./category-select";
import { InsightLoading } from "./insight-loading";

interface InsightViewProps {
  statsFrom?: Date;
  environmentId: string;
  documentsPerPage: number;
  insightsPerPage: number;
}

export const InsightView = ({
  statsFrom,
  environmentId,
  insightsPerPage,
  documentsPerPage,
}: InsightViewProps) => {
  const [insights, setInsights] = useState<TInsight[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isInsightSheetOpen, setIsInsightSheetOpen] = useState(false);
  const [currentInsight, setCurrentInsight] = useState<TInsight | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [showArchived, setShowArchived] = useState<boolean>(false); // New state variable

  const handleFeedback = (feedback: "positive" | "negative") => {
    formbricks.track("AI Insight Feedback", {
      hiddenFields: {
        feedbackSentiment: feedback,
        insightId: currentInsight?.id,
        insightTitle: currentInsight?.title,
        insightDescription: currentInsight?.description,
        insightCategory: currentInsight?.category,
        environmentId: currentInsight?.environmentId,
      },
    });
  };

  const insightsFilter: TInsightFilterCriteria = useMemo(
    () => ({
      documentCreatedAt: {
        min: statsFrom,
      },
      category: activeTab === "all" ? undefined : (activeTab as TInsight["category"]),
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

  const handleArchiveToggle = async (insightId: string, shouldArchive: boolean) => {
    try {
      await updateInsightAction({
        environmentId,
        insightId,
        updates: { archived: shouldArchive },
      });
      // Update the local state to reflect the change
      setInsights((prevInsights) =>
        prevInsights.map((insight) =>
          insight.id === insightId ? { ...insight, archived: shouldArchive } : insight
        )
      );
      toast.success(`Insight ${shouldArchive ? "archived" : "unarchived"} successfully.`);
    } catch (error) {
      console.error(`Failed to ${shouldArchive ? "archive" : "unarchive"} insight:`, error);
      toast.error(`Failed to ${shouldArchive ? "archive" : "unarchive"} insight.`);
    }
  };

  const filteredInsights = useMemo(() => {
    return insights.filter((insight) => (showArchived ? insight.archived : !insight.archived));
  }, [insights, showArchived]);

  return (
    <div>
      <Tabs defaultValue="all" onValueChange={handleFilterSelect}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="complaint">Complaint</TabsTrigger>
            <TabsTrigger value="featureRequest">Request</TabsTrigger>
            <TabsTrigger value="praise">Praise</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>
          <div className="flex items-center space-x-2">
            <Label htmlFor="archived-toggle">Archive</Label>
            <Switch
              id="archived-toggle"
              checked={showArchived}
              onCheckedChange={() => setShowArchived((prev) => !prev)}
            />
          </div>
        </div>
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
              {filteredInsights.length === 0 && !isFetching ? (
                <TableRow className="pointer-events-none">
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-slate-500">
                      No insights found. Collect more survey responses or enable insights for your existing
                      surveys to get started.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInsights.map((insight) => (
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
                      <CategoryBadge
                        category={insight.category}
                        environmentId={environmentId}
                        insightId={insight.id}
                      />
                      <Button
                        variant="minimal"
                        size="icon"
                        className="hover:bg-white"
                        tooltip={insight.archived ? "Unarchive insight" : "Archive insight"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleArchiveToggle(insight.id, !insight.archived);
                        }}>
                        {insight.archived ? (
                          <ArchiveRestoreIcon className="h-4 w-4" />
                        ) : (
                          <ArchiveIcon className="h-4 w-4" />
                        )}
                      </Button>
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
            Load more
          </Button>
        </div>
      )}

      <InsightSheet
        environmentId={environmentId}
        isOpen={isInsightSheetOpen}
        setIsOpen={setIsInsightSheetOpen}
        insight={currentInsight}
        handleFeedback={handleFeedback}
        documentsFilter={documentsFilter}
        documentsPerPage={documentsPerPage}
      />
    </div>
  );
};
