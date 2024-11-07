"use server";

import { insightCache } from "@/lib/cache/insight";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { cache } from "@formbricks/lib/cache";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import { ZInsight, ZInsightFilterCriteria } from "@formbricks/types/insights";
import { getInsights, updateInsight } from "./lib/insights";
import { getStats } from "./lib/stats";

const ZGetEnvironmentInsightsAction = z.object({
  environmentId: ZId,
  limit: z.number().optional(),
  offset: z.number().optional(),
  insightsFilter: ZInsightFilterCriteria.optional(),
});

export const getEnvironmentInsightsAction = authenticatedActionClient
  .schema(ZGetEnvironmentInsightsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["response", "read"],
    });

    return await getInsights(
      parsedInput.environmentId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.insightsFilter
    );
  });

const ZGetStatsAction = z.object({
  environmentId: ZId,
  statsFrom: z.date().optional(),
});

export const getStatsAction = authenticatedActionClient
  .schema(ZGetStatsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["response", "read"],
    });

    return await getStats(parsedInput.environmentId, parsedInput.statsFrom);
  });

const ZUpdateInsightAction = z.object({
  insightId: ZId,
  data: ZInsight.partial(),
});

export const updateInsightAction = authenticatedActionClient
  .schema(ZUpdateInsightAction)
  .action(async ({ ctx, parsedInput }) => {
    try {
      const insight = await cache(
        () =>
          prisma.insight.findUnique({
            where: {
              id: parsedInput.insightId,
            },
            select: {
              environmentId: true,
            },
          }),
        [`getInsight-${parsedInput.insightId}`],
        {
          tags: [insightCache.tag.byId(parsedInput.insightId)],
        }
      )();

      if (!insight) {
        throw new Error("Insight not found");
      }

      await checkAuthorization({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromEnvironmentId(insight.environmentId),
        rules: ["response", "update"],
      });

      return await updateInsight(parsedInput.insightId, parsedInput.data);
    } catch (error) {
      console.error("Error updating insight:", {
        insightId: parsedInput.insightId,
        error,
      });
      if (error instanceof Error) {
        throw new Error(`Failed to update insight: ${error.message}`);
      }
      throw new Error("An unexpected error occurred while updating the insight");
    }
  });
