"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import { ZInsightFilterCriteria } from "@formbricks/types/insights";
import { getInsights } from "./lib/insights";
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["response", "read"],
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["response", "read"],
        },
      ],
    });

    return await getStats(parsedInput.environmentId, parsedInput.statsFrom);
  });
