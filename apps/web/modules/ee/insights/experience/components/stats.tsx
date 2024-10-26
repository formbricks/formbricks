"use client";

import { getStatsAction } from "@/modules/ee/insights/experience/actions";
import { TStats } from "@/modules/ee/insights/experience/types/stats";
import {
  ActivityIcon,
  FrownIcon,
  GaugeIcon,
  InboxIcon,
  MehIcon,
  MessageCircleIcon,
  SmileIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { Card, CardContent, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import { TooltipRenderer } from "@formbricks/ui/components/Tooltip";

interface ExperiencePageStatsProps {
  statsFrom?: Date;
  environmentId: string;
}

export const ExperiencePageStats = ({ statsFrom, environmentId }: ExperiencePageStatsProps) => {
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
      title: "Sentiment Score",
      value: stats.sentimentScore ? `${Math.floor(stats.sentimentScore * 100)}%` : "-",
      icon: GaugeIcon,
      width: "w-20",
    },
    {
      key: "activeSurveys",
      title: "Active Surveys",
      value: stats.activeSurveys,
      icon: MessageCircleIcon,
      width: "w-10",
    },
    {
      key: "newResponses",
      title: "New Responses",
      value: stats.newResponses,
      icon: InboxIcon,
      width: "w-10",
    },
    {
      key: "analysedFeedbacks",
      title: "Analysed Feedbacks",
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
          <CardContent className="">
            {stat.key === "sentimentScore" && stats.overallSentiment && (
              <div className="flex items-center font-medium text-slate-700">
                {stats.overallSentiment === "positive" ? (
                  <TooltipRenderer tooltipContent="Mostly positive">
                    <SmileIcon className="h-10 w-10" strokeWidth={1.5} />
                  </TooltipRenderer>
                ) : stats.overallSentiment === "negative" ? (
                  <TooltipRenderer tooltipContent="Mostly negative">
                    <FrownIcon className="h-10 w-10" strokeWidth={1.5} />
                  </TooltipRenderer>
                ) : (
                  <TooltipRenderer tooltipContent="Mostly negative">
                    <MehIcon className="h-10 w-10" strokeWidth={1.5} />
                  </TooltipRenderer>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
