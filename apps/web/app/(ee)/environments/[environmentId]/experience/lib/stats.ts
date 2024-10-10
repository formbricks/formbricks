import "server-only";
import { getDateFromTimeRange } from "@/app/(ee)/environments/[environmentId]/experience/lib/utils";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TStats, TStatsPeriod } from "../types/stats";

export const getStats = reactCache(
  (environmentId: string, timeRange: TStatsPeriod): Promise<TStats> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
          const timeRangeValue = getDateFromTimeRange(timeRange);

          const environmentSurveys = await prisma.survey.findMany({
            where: {
              environmentId,
            },
            select: {
              id: true,
            },
          });

          const groupedRespones = await prisma.response.groupBy({
            by: ["surveyId"],
            _count: {
              surveyId: true,
            },
            where: {
              surveyId: {
                in: environmentSurveys.map((survey) => survey.id),
              },
              createdAt: {
                gte: timeRangeValue,
              },
            },
          });

          const activeSurveys = groupedRespones.length;

          const newResponses = groupedRespones.reduce((acc, { _count }) => acc + _count.surveyId, 0);

          const groupedSentiments = await prisma.document.groupBy({
            by: ["sentiment"],
            _count: {
              sentiment: true,
            },
            where: {
              survey: {
                environmentId,
              },
              createdAt: {
                gte: timeRangeValue,
              },
            },
          });

          const sentimentCounts = groupedSentiments.reduce(
            (acc, { sentiment, _count }) => {
              acc[sentiment] = _count.sentiment;
              return acc;
            },
            {
              positive: 0,
              negative: 0,
              neutral: 0,
            }
          );

          // analysed feedbacks is the sum of all the sentiments
          const analysedFeedbacks = Object.values(sentimentCounts).reduce((acc, count) => acc + count, 0);

          let overallSentiment: TStats["overallSentiment"] = "neutral";

          if (
            sentimentCounts.positive > sentimentCounts.negative &&
            sentimentCounts.positive > sentimentCounts.neutral
          ) {
            overallSentiment = "positive";
          } else if (
            sentimentCounts.negative > sentimentCounts.positive &&
            sentimentCounts.negative > sentimentCounts.neutral
          ) {
            overallSentiment = "negative";
          }

          return { newResponses, activeSurveys, analysedFeedbacks, overallSentiment };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`stats-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);
