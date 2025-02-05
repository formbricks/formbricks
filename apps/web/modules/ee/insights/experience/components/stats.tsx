"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getStatsAction } from "@/modules/ee/insights/experience/actions";
import { TStats } from "@/modules/ee/insights/experience/types/stats";
import { Badge } from "@/modules/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import { useTranslate } from "@tolgee/react";
import { ActivityIcon, GaugeIcon, InboxIcon, MessageCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface ExperiencePageStatsProps {
  statsFrom?: Date;
  environmentId: string;
}

export const ExperiencePageStats = ({ statsFrom, environmentId }: ExperiencePageStatsProps) => {
  const { t } = useTranslate();
  const [stats, setStats] = useState<TStats>({
    activeSurveys: 0,
    newResponses: 0,
    analysedFeedbacks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      const getStatsResponse = await getStatsAction({ environmentId, statsFrom });

      if (getStatsResponse?.data) {
        setStats(getStatsResponse.data);
      } else {
        const errorMessage = getFormattedErrorMessage(getStatsResponse);
        toast.error(errorMessage);
      }
      setIsLoading(false);
    };

    getData();
  }, [environmentId, statsFrom]);

  const statsData = [
    {
      key: "sentimentScore",
      title: t("environments.experience.sentiment_score"),
      value: stats.sentimentScore ? `${Math.floor(stats.sentimentScore * 100)}%` : "-",
      icon: GaugeIcon,
      width: "w-20",
    },
    {
      key: "activeSurveys",
      title: t("common.active_surveys"),
      value: stats.activeSurveys,
      icon: MessageCircleIcon,
      width: "w-10",
    },
    {
      key: "newResponses",
      title: t("environments.experience.new_responses"),
      value: stats.newResponses,
      icon: InboxIcon,
      width: "w-10",
    },
    {
      key: "analysedFeedbacks",
      title: t("environments.experience.analysed_feedbacks"),
      value: stats.analysedFeedbacks,
      icon: ActivityIcon,
      width: "w-10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      {statsData.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-bold capitalize">
              {isLoading ? (
                <div className={cn("h-4 animate-pulse rounded-full bg-slate-200", stat.width)}></div>
              ) : stat.key === "sentimentScore" ? (
                <div className="flex items-center font-medium text-slate-700">
                  <TooltipRenderer tooltipContent={`${stat.value} positive`}>
                    {stats.overallSentiment === "positive" ? (
                      <Badge type="success" size="large" text={t("common.positive")} />
                    ) : stats.overallSentiment === "negative" ? (
                      <Badge type="error" size="large" text={t("common.negative")} />
                    ) : (
                      <Badge type="gray" size="large" text={t("common.neutral")} />
                    )}
                  </TooltipRenderer>
                </div>
              ) : (
                (stat.value ?? "-")
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
