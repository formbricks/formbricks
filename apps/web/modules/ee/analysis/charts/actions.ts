"use server";

import { z } from "zod";
import { ZChartQuery } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { createChart, getChart, getCharts, updateChart } from "@/modules/ee/analysis/charts/lib/charts";
import { checkFeedbackDirectoryAccess, checkWorkspaceAccess } from "@/modules/ee/analysis/lib/access";
import {
  type TDimensionValue,
  buildDimensionValueQuery,
  collectDimensionValues,
} from "@/modules/ee/analysis/lib/dimension-value-lookup";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { isSelectableValueDimension } from "@/modules/ee/analysis/lib/schema-definition";
import { ZChartCreateInput, ZChartUpdateInput } from "@/modules/ee/analysis/types/analysis";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";

const checkDashboardsEnabled = async (organizationId: string) => {
  const isAllowed = await getIsDashboardsEnabled(organizationId);
  if (!isAllowed) {
    throw new OperationNotAllowedError("Dashboards are not enabled for this organization");
  }
};

/** Client-facing chart input (workspaceId and createdBy are resolved server-side) */
const ZChartCreateInputClient = ZChartCreateInput.omit({ workspaceId: true, createdBy: true });

const ZCreateChartAction = z.object({
  workspaceId: ZId,
  chartInput: ZChartCreateInputClient,
});

export const createChartAction = authenticatedActionClient.inputSchema(ZCreateChartAction).action(
  withAuditLogging(
    "created",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateChartAction>;
    }) => {
      ctx.auditLoggingCtx.workspaceId = parsedInput.workspaceId;
      await applyRateLimit(rateLimitConfigs.actions.chartCreation, ctx.user.id);
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      await checkFeedbackDirectoryAccess({
        feedbackDirectoryId: parsedInput.chartInput.feedbackDirectoryId,
        workspaceId,
        userId: ctx.user.id,
        minPermission: "readWrite",
        source: "charts.createChartAction",
      });

      const chart = await createChart({
        ...parsedInput.chartInput,
        workspaceId,
        createdBy: ctx.user.id,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = chart.id;
      ctx.auditLoggingCtx.newObject = chart;
      capturePostHogEvent(
        ctx.user.id,
        "chart_created",
        { chart_id: chart.id },
        { organizationId, workspaceId }
      );
      return chart;
    }
  )
);

const ZUpdateChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
  chartUpdateInput: ZChartUpdateInput,
});

export const updateChartAction = authenticatedActionClient.inputSchema(ZUpdateChartAction).action(
  withAuditLogging(
    "updated",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateChartAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      const { chart, updatedChart } = await updateChart(
        parsedInput.chartId,
        workspaceId,
        parsedInput.chartUpdateInput
      );

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = parsedInput.chartId;
      ctx.auditLoggingCtx.oldObject = chart;
      ctx.auditLoggingCtx.newObject = updatedChart;
      return updatedChart;
    }
  )
);

const ZGetChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
});

export const getChartAction = authenticatedActionClient
  .inputSchema(ZGetChartAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetChartAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "read"
      );
      await checkDashboardsEnabled(organizationId);

      return getChart(parsedInput.chartId, workspaceId);
    }
  );

const ZGetChartsAction = z.object({
  workspaceId: ZId,
});

export const getChartsAction = authenticatedActionClient
  .inputSchema(ZGetChartsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetChartsAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "read"
      );
      await checkDashboardsEnabled(organizationId);
      const charts = await getCharts(workspaceId);
      return charts;
    }
  );

// ── Charts UI specific actions (query execution & AI generation) ─────────────

const ZExecuteQueryAction = z.object({
  workspaceId: ZId,
  query: ZChartQuery,
  feedbackDirectoryId: ZId,
});

export const executeQueryAction = authenticatedActionClient
  .inputSchema(ZExecuteQueryAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZExecuteQueryAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "read"
      );

      await checkDashboardsEnabled(organizationId);

      const { feedbackDirectoryId } = await checkFeedbackDirectoryAccess({
        feedbackDirectoryId: parsedInput.feedbackDirectoryId,
        workspaceId,
        userId: ctx.user.id,
        minPermission: "read",
        source: "charts.executeQueryAction",
      });

      return runChartQuery({
        query: parsedInput.query,
        datasetId: feedbackDirectoryId,
        workspaceId,
        organizationId,
        actor: { type: "user", id: ctx.user.id },
        source: "charts.executeQueryAction",
      });
    }
  );

// Max distinct values returned for a filter value pick-list. Bounded so high-cardinality
// dimensions stay responsive; the `search` term narrows results server-side beyond this cap.
const DIMENSION_VALUE_LOOKUP_LIMIT = 100;

const ZGetDimensionValuesAction = z.object({
  workspaceId: ZId,
  feedbackDirectoryId: ZId,
  dimension: z.string().refine(isSelectableValueDimension, {
    message: "Unsupported dimension for value lookup",
  }),
  search: z.string().trim().max(255).optional(),
});

/**
 * Returns the distinct stored values for a low-cardinality string dimension, so the
 * filter UI can offer a pick-list instead of free-text entry. Picking a real value
 * guarantees an exact match for the `equals` / `notEquals` operators. Search narrows
 * results server-side so dimensions with more than the lookup cap stay usable.
 */
export const getDimensionValuesAction = authenticatedActionClient
  .inputSchema(ZGetDimensionValuesAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetDimensionValuesAction>;
    }): Promise<TDimensionValue[]> => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "read"
      );

      await checkDashboardsEnabled(organizationId);

      const { feedbackDirectoryId } = await checkFeedbackDirectoryAccess({
        feedbackDirectoryId: parsedInput.feedbackDirectoryId,
        workspaceId,
        userId: ctx.user.id,
        minPermission: "read",
        source: "charts.getDimensionValuesAction",
      });

      const { dimension, search } = parsedInput;

      const rows = await executeTenantScopedQuery({
        query: buildDimensionValueQuery({ dimension, limit: DIMENSION_VALUE_LOOKUP_LIMIT, search }),
        feedbackDirectoryId,
        workspaceId,
        organizationId,
        actor: { type: "user", id: ctx.user.id },
        source: "charts.getDimensionValuesAction",
      });

      return collectDimensionValues(rows, dimension, DIMENSION_VALUE_LOOKUP_LIMIT);
    }
  );
