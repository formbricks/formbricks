import "server-only";
import { documentCache } from "@/lib/cache/document";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TStats } from "../types/stats";

export const getStats = reactCache(
  async (environmentId: string, statsFrom?: Date): Promise<TStats> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
          const groupedResponesPromise = prisma.response.groupBy({
            by: ["surveyId"],
            _count: {
              surveyId: true,
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

          const groupedSentimentsPromise = prisma.document.groupBy({
            by: ["sentiment"],
            _count: {
              sentiment: true,
            },
            where: {
              environmentId,
              createdAt: {
                gte: statsFrom,
              },
            },
          });

          const [groupedRespones, groupedSentiments] = await Promise.all([
            groupedResponesPromise,
            groupedSentimentsPromise,
          ]);

          const activeSurveys = groupedRespones.length;

          const newResponses = groupedRespones.reduce((acc, { _count }) => acc + _count.surveyId, 0);

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

          // the sentiment score is the ratio of positive to total (positive + negative) sentiment counts. For this we ignore neutral sentiment counts.
          let sentimentScore: number = 0,
            overallSentiment: TStats["overallSentiment"];

          if (sentimentCounts.positive || sentimentCounts.negative) {
            sentimentScore = sentimentCounts.positive / (sentimentCounts.positive + sentimentCounts.negative);

            overallSentiment =
              sentimentScore > 0.5 ? "positive" : sentimentScore < 0.5 ? "negative" : "neutral";
          }

          return {
            newResponses,
            activeSurveys,
            analysedFeedbacks,
            sentimentScore,
            overallSentiment,
          };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`stats-${environmentId}-${statsFrom?.toDateString()}`],
      {
        tags: [
          responseCache.tag.byEnvironmentId(environmentId),
          documentCache.tag.byEnvironmentId(environmentId),
        ],
      }
    )()
);
