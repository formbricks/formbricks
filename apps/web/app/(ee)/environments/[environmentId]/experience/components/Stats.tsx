"use client";

import { getStatsAction } from "@/app/(ee)/environments/[environmentId]/experience/actions";
import { ActivityIcon, DollarSignIcon, InboxIcon, MessageCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { cn } from "@formbricks/lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import { ToggleGroup, ToggleGroupItem } from "@formbricks/ui/components/ToggleGroup";
import type { TStats, TStatsPeriod } from "../types/stats";

interface ExperiencePageStatsProps {
  environmentId: string;
}

export const ExperiencePageStats = ({ environmentId }: ExperiencePageStatsProps) => {
  const [timeRange, setTimeRange] = useState<TStatsPeriod>("week");
  const [stats, setStats] = useState<TStats>({
    overallSentiment: "neutral",
    activeSurveys: 0,
    analysedFeedbacks: 0,
    newResponses: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      const getStatsResponse = await getStatsAction({ environmentId, timeRange });

      if (getStatsResponse?.data) {
        setStats(getStatsResponse.data);
      } else {
        const errorMessage = getFormattedErrorMessage(getStatsResponse);
        toast.error(errorMessage);
      }
      setIsLoading(false);
    };

    getData();
  }, [timeRange]);

  const statsData = [
    {
      title: "Overall Sentiment",
      value: stats.overallSentiment,
      icon: DollarSignIcon,
      width: "w-20",
    },
    {
      title: "Active Surveys",
      value: stats.activeSurveys,
      icon: MessageCircleIcon,
      width: "w-10",
    },
    {
      title: "New Responses",
      value: stats.newResponses,
      icon: InboxIcon,
      width: "w-10",
    },
    {
      title: "Analysed Feedbacks",
      value: stats.analysedFeedbacks,
      icon: ActivityIcon,
      width: "w-10",
    },
  ];

  return (
    <>
      <ToggleGroup
        type="single"
        value={timeRange}
        onValueChange={(value) => value && setTimeRange(value as TStatsPeriod)}>
        <ToggleGroupItem value="all" aria-label="Toggle all">
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="day" aria-label="Toggle day">
          Day
        </ToggleGroupItem>
        <ToggleGroupItem value="week" aria-label="Toggle week">
          Week
        </ToggleGroupItem>
        <ToggleGroupItem value="month" aria-label="Toggle month">
          Month
        </ToggleGroupItem>
        <ToggleGroupItem value="quarter" aria-label="Toggle quarter">
          Quarter
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        {statsData.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {isLoading ? (
                  <div className={cn("h-8 animate-pulse rounded bg-gray-200", stat.width)}></div>
                ) : (
                  stat.value
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};
