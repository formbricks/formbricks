"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromInsightId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromInsightId,
} from "@/lib/utils/helper";
import { checkAIPermission } from "@/modules/ee/insights/actions";
import { ZInsightFilterCriteria } from "@/modules/ee/insights/experience/types/insights";
import { z } from "zod";
import { ZInsight } from "@formbricks/database/zod/insights";
import { ZId } from "@formbricks/types/common";
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
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    await checkAIPermission(organizationId);

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
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    await checkAIPermission(organizationId);
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
      const organizationId = await getOrganizationIdFromInsightId(parsedInput.insightId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: await getProjectIdFromInsightId(parsedInput.insightId),
            minPermission: "readWrite",
          },
        ],
      });

      await checkAIPermission(organizationId);

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
