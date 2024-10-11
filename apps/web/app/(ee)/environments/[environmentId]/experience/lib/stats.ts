import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TStats } from "../types/stats";

export const getStats = reactCache(
  (environmentId: string, statsFrom?: Date): Promise<TStats> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
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
                gte: statsFrom,
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
                gte: statsFrom,
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

          let overallSentiment: TStats["overallSentiment"];

          if (analysedFeedbacks > 0) {
            if (
              sentimentCounts.negative >= sentimentCounts.positive &&
              sentimentCounts.negative >= sentimentCounts.neutral
            ) {
              const sentimentPercent = ((sentimentCounts.negative / analysedFeedbacks) * 100).toFixed(2);
              overallSentiment = `negative(${sentimentPercent} %)`;
            }

            if (
              sentimentCounts.positive >= sentimentCounts.negative &&
              sentimentCounts.positive >= sentimentCounts.neutral
            ) {
              const sentimentPercent = ((sentimentCounts.positive / analysedFeedbacks) * 100).toFixed(2);
              overallSentiment = `positive(${sentimentPercent} %)`;
            }

            if (!overallSentiment && analysedFeedbacks > 0) {
              const sentimentPercent = ((sentimentCounts.neutral / analysedFeedbacks) * 100).toFixed(2);
              overallSentiment = `neutral(${sentimentPercent} %)`;
            }
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
      [`stats-${environmentId}-${statsFrom}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);
