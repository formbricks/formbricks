"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkWorkspaceAccess } from "@/modules/ee/analysis/lib/access";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getDashboards } from "./lib/dashboards";

const checkDashboardsEnabled = async (organizationId: string) => {
  const isAllowed = await getIsDashboardsEnabled(organizationId);
  if (!isAllowed) {
    throw new OperationNotAllowedError("Dashboards are not enabled for this organization");
  }
};

const ZGetDashboardsAction = z.object({
  workspaceId: ZId,
  chartId: ZId.optional(),
});

export const getDashboardsAction = authenticatedActionClient
  .inputSchema(ZGetDashboardsAction)
  .action(async ({ ctx, parsedInput }) => {
    const { organizationId, workspaceId } = await checkWorkspaceAccess(
      ctx.user.id,
      parsedInput.workspaceId,
      "read"
    );
    await checkDashboardsEnabled(organizationId);

    return getDashboards(workspaceId, parsedInput.chartId);
  });
