"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
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
  environmentId: ZId,
  insightId: ZId,
  updates: ZInsight.partial(),
});

export const updateInsightAction = authenticatedActionClient
  .schema(ZUpdateInsightAction)
  .action(async ({ ctx, parsedInput }) => {
    try {
      await checkAuthorization({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
        rules: ["response", "update"],
      });

      return await updateInsight(parsedInput.insightId, parsedInput.updates);
    } catch (error) {
      console.error("Error updating insight:", {
        insightId: parsedInput.insightId,
        environmentId: parsedInput.environmentId,
        error,
      });
      if (error instanceof Error) {
        throw new Error(`Failed to update insight: ${error.message}`);
      }
      throw new Error("An unexpected error occurred while updating the insight");
    }
  });
