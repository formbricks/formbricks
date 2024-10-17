"use server";

import { getStats } from "@/app/(ee)/(insights)/environments/[environmentId]/experience/lib/stats";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getInsights } from "@formbricks/lib/insight/service";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import { ZInsightFilterCriteria } from "@formbricks/types/insights";

const ZGetInsightsAction = z.object({
  environmentId: ZId,
  limit: z.number().optional(),
  offset: z.number().optional(),
  insightsFilter: ZInsightFilterCriteria.optional(),
});

export const getInsightsAction = authenticatedActionClient
  .schema(ZGetInsightsAction)
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
