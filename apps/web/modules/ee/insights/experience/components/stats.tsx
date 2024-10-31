"use client";

import { getStatsAction } from "@/modules/ee/insights/experience/actions";
import { TStats } from "@/modules/ee/insights/experience/types/stats";
import { ActivityIcon, GaugeIcon, InboxIcon, MessageCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { Badge } from "@formbricks/ui/components/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import { cn } from "@formbricks/ui/lib/utils";

interface ExperiencePageStatsProps {
  statsFrom?: Date;
  environmentId: string;
}

export const ExperiencePageStats = ({ statsFrom, environmentId }: ExperiencePageStatsProps) => {
  const t = useTranslations();
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
                <div className={cn("h-8 animate-pulse rounded bg-gray-200", stat.width)}></div>
              ) : (
                (stat.value ?? "-")
              )}
            </div>
            {stat.key === "sentimentScore" && stats.overallSentiment && (
              <div>
                {stats.overallSentiment === "positive" ? (
                  <Badge text={t("environments.experience.positive")} type="success" size="tiny" />
                ) : (
                  <Badge text={t("environments.experience.negative")} type="error" size="tiny" />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
