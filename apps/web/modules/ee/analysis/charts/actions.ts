"use server";

import { z } from "zod";
import {
  type TChartQuery,
  type TCubeFilter,
  type TMemberFilter,
  ZChartQuery,
} from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElementChoice } from "@formbricks/types/surveys/elements";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { capturePostHogEvent } from "@/lib/posthog";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { generateAIChartQuery } from "@/modules/ee/analysis/charts/lib/ai-chart-query.server";
import {
  createChart,
  deleteChart,
  duplicateChart,
  getChart,
  getCharts,
  updateChart,
} from "@/modules/ee/analysis/charts/lib/charts";
import { splitMultiSelectRows } from "@/modules/ee/analysis/charts/lib/multi-select-split";
import { checkFeedbackDirectoryAccess, checkWorkspaceAccess } from "@/modules/ee/analysis/lib/access";
import { isSelectableValueDimension } from "@/modules/ee/analysis/lib/schema-definition";
import { ZChartCreateInput, ZChartUpdateInput } from "@/modules/ee/analysis/types/analysis";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";

// ── Single-select option-id resolution helpers ────────────────────────────────

/** Extract the first `equals` value for a member filter by member name, searching top-level filters only. */
function extractMemberEqualsValue(filters: TCubeFilter[], member: string): string | undefined {
  for (const f of filters) {
    if (
      "member" in f &&
      (f as TMemberFilter).member === member &&
      (f as TMemberFilter).operator === "equals"
    ) {
      const values = (f as TMemberFilter).values;
      if (Array.isArray(values) && values.length > 0) return values[0];
    }
  }
  return undefined;
}

const getChoiceLabelDefault = (choice: { label: TSurveyElementChoice["label"] }): string =>
  getTextContent(getLocalizedValue(choice.label, "default"));

/**
 * When a query groups by `FeedbackRecords.valueText` and a `FeedbackRecords.fieldId equals <id>`
 * filter is present, inspect the element type and apply the appropriate grouping strategy:
 *
 * - MultipleChoiceSingle: rewrite the dimension to `FeedbackRecords.valueId` so Cube groups
 *   by stable option ids, and return a `{ [value_id]: defaultLabel }` map for the renderer.
 *
 * - MultipleChoiceMulti: Cube still groups by `valueText` (no per-option value_id is stored
 *   yet — that requires a hub change tracked separately). Set `splitMultiSelect: true` so
 *   the caller can post-process rows by splitting the ", "-joined value string server-side.
 *
 * If no `fieldId` filter is present, falls back to a `FeedbackRecords.fieldLabel equals <label>`
 * filter: loads all source mappings, computes each mapping's effective label
 * (customFieldLabel if set, else the element's default-language headline — same logic as
 * transform.ts), and resolves exactly one match. If zero or multiple mappings share the same
 * label (ambiguous), the query is returned unchanged rather than guessing.
 *
 * Returns `{ rewrittenQuery, optionLabels, splitMultiSelect }`. When no rewrite is needed,
 * `rewrittenQuery` is the original query and the other fields are undefined / false.
 */
async function resolveOptionGrouping(
  query: TChartQuery,
  workspaceId: string
): Promise<{
  rewrittenQuery: TChartQuery;
  optionLabels?: Record<string, string>;
  splitMultiSelect?: boolean;
}> {
  const dimensions = query.dimensions;
  if (!dimensions?.includes("FeedbackRecords.valueText")) {
    return { rewrittenQuery: query };
  }

  const fieldId = extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldId");

  // ── Resolve element via fieldId (preferred) or fieldLabel (fallback) ──────
  let resolvedElementId: string | undefined;
  let resolvedSurveyId: string | undefined;

  if (fieldId) {
    // Existing path: fieldId filter is present — find the survey that owns this element.
    const feedbackSources = await getFeedbackSourcesWithMappings(workspaceId);
    for (const source of feedbackSources) {
      const mapping = source.formbricksMappings.find((m) => m.elementId === fieldId);
      if (mapping) {
        resolvedElementId = fieldId;
        resolvedSurveyId = mapping.surveyId;
        break;
      }
    }
  } else {
    // Fallback path: check for a FeedbackRecords.fieldLabel equals filter.
    // Users filter by "Question" (fieldLabel) rather than the internal fieldId, so we
    // resolve the label → elementId by matching the mapping's effective label — which is
    // customFieldLabel if set, otherwise the element's default-language headline (mirroring
    // how transform.ts computes field_label on ingest).
    const fieldLabelFilter = extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldLabel");
    if (!fieldLabelFilter) {
      return { rewrittenQuery: query };
    }

    const feedbackSources = await getFeedbackSourcesWithMappings(workspaceId);

    // Collect candidates: mappings whose effective label exactly matches the filter value.
    // Dedupe survey loads so we only call getSurvey once per distinct surveyId.
    const surveyCache = new Map<string, Awaited<ReturnType<typeof getSurvey>>>();
    const loadSurvey = async (surveyId: string) => {
      if (!surveyCache.has(surveyId)) {
        surveyCache.set(surveyId, await getSurvey(surveyId));
      }
      return surveyCache.get(surveyId);
    };

    const candidates: { elementId: string; surveyId: string }[] = [];

    for (const source of feedbackSources) {
      for (const mapping of source.formbricksMappings) {
        // Fast path: customFieldLabel is already stored on the mapping.
        if (mapping.customFieldLabel !== null && mapping.customFieldLabel !== undefined) {
          if (mapping.customFieldLabel === fieldLabelFilter) {
            candidates.push({ elementId: mapping.elementId, surveyId: mapping.surveyId });
          }
          // Even if customFieldLabel doesn't match, skip the survey load for this mapping
          // because the effective label is the custom one, not the headline.
          continue;
        }

        // No customFieldLabel → effective label is the element's default-language headline.
        const survey = await loadSurvey(mapping.surveyId);
        if (!survey) continue;
        const elements = getElementsFromBlocks(survey.blocks);
        const element = elements.find((el) => el.id === mapping.elementId);
        if (!element) continue;
        const headline = getTextContent(getLocalizedValue(element.headline ?? {}, "default"));
        if (headline === fieldLabelFilter) {
          candidates.push({ elementId: mapping.elementId, surveyId: mapping.surveyId });
        }
      }
    }

    // Ambiguity guard: if zero or multiple mappings share this label, do not guess.
    if (candidates.length !== 1) {
      return { rewrittenQuery: query };
    }

    resolvedElementId = candidates[0].elementId;
    resolvedSurveyId = candidates[0].surveyId;
  }

  if (!resolvedElementId || !resolvedSurveyId) {
    return { rewrittenQuery: query };
  }

  const survey = await getSurvey(resolvedSurveyId);
  if (!survey) {
    return { rewrittenQuery: query };
  }

  const elements = getElementsFromBlocks(survey.blocks);
  const element = elements.find((el) => el.id === resolvedElementId);
  if (!element) {
    return { rewrittenQuery: query };
  }

  // ── MultipleChoiceSingle: rewrite dimension to valueId for stable grouping ──
  if (element.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
    // Build the choice-id → default-language label map.
    const choices = (element as { choices: { id: string; label: TSurveyElementChoice["label"] }[] }).choices;
    const optionLabels: Record<string, string> = {};
    for (const choice of choices) {
      optionLabels[choice.id] = getChoiceLabelDefault(choice);
    }

    // Rewrite valueText → valueId in dimensions.
    const rewrittenQuery: TChartQuery = {
      ...query,
      dimensions: dimensions.map((d) => (d === "FeedbackRecords.valueText" ? "FeedbackRecords.valueId" : d)),
    };

    return { rewrittenQuery, optionLabels };
  }

  // ── MultipleChoiceMulti: split ", "-joined valueText server-side after the query ──
  if (element.type === TSurveyElementTypeEnum.MultipleChoiceMulti) {
    // Do NOT rewrite to valueId — no per-option value_id is stored for multi-select yet
    // (blocked on a hub change). Keep grouping by valueText and flag for post-processing.
    return { rewrittenQuery: query, splitMultiSelect: true };
  }

  return { rewrittenQuery: query };
}

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
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      await checkFeedbackDirectoryAccess({
        feedbackDirectoryId: parsedInput.chartInput.feedbackDirectoryId,
        organizationId,
        workspaceId,
        userId: ctx.user.id,
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

const ZDuplicateChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
});

export const duplicateChartAction = authenticatedActionClient.inputSchema(ZDuplicateChartAction).action(
  withAuditLogging(
    "created",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDuplicateChartAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      const duplicatedChart = await duplicateChart(parsedInput.chartId, workspaceId, ctx.user.id);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = duplicatedChart.id;
      ctx.auditLoggingCtx.newObject = duplicatedChart;
      return duplicatedChart;
    }
  )
);

const ZDeleteChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
});

export const deleteChartAction = authenticatedActionClient.inputSchema(ZDeleteChartAction).action(
  withAuditLogging(
    "deleted",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteChartAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      const chart = await deleteChart(parsedInput.chartId, workspaceId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = parsedInput.chartId;
      ctx.auditLoggingCtx.oldObject = chart;
      return { success: true };
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
        organizationId,
        workspaceId,
        userId: ctx.user.id,
        source: "charts.executeQueryAction",
      });

      const { rewrittenQuery, optionLabels, splitMultiSelect } = await resolveOptionGrouping(
        parsedInput.query,
        workspaceId
      );

      const rawRows = await executeTenantScopedQuery({
        query: rewrittenQuery,
        feedbackDirectoryId,
        workspaceId,
        organizationId,
        userId: ctx.user.id,
        source: "charts.executeQueryAction",
      });

      let rows = Array.isArray(rawRows) ? rawRows : [];

      if (splitMultiSelect) {
        // Derive measure keys generically from the query so we don't hardcode only count.
        const measureKeys = rewrittenQuery.measures ?? [];
        rows = splitMultiSelectRows(
          rows as Record<string, string | number | boolean | null | undefined>[],
          "FeedbackRecords.valueText",
          measureKeys
        );
      }

      return { rows, ...(optionLabels ? { optionLabels } : {}) };
    }
  );

const ZGenerateAIChartAction = z.object({
  workspaceId: ZId,
  prompt: z.string().min(1).max(2000),
  feedbackDirectoryId: ZId,
});

export const generateAIChartAction = authenticatedActionClient
  .inputSchema(ZGenerateAIChartAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGenerateAIChartAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "read"
      );

      await checkDashboardsEnabled(organizationId);

      const { feedbackDirectoryId } = await checkFeedbackDirectoryAccess({
        feedbackDirectoryId: parsedInput.feedbackDirectoryId,
        organizationId,
        workspaceId,
        userId: ctx.user.id,
        source: "charts.generateAIChartAction",
      });

      const { chartType, query } = await generateAIChartQuery({
        organizationId,
        prompt: parsedInput.prompt,
      });

      const validatedQuery = ZChartQuery.parse(query);

      const data = await executeTenantScopedQuery({
        query: validatedQuery,
        feedbackDirectoryId,
        workspaceId,
        organizationId,
        userId: ctx.user.id,
        source: "charts.generateAIChartAction",
      });

      return {
        query: validatedQuery,
        chartType,
        data: Array.isArray(data) ? data : [],
      };
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
    }): Promise<string[]> => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "read"
      );

      await checkDashboardsEnabled(organizationId);

      const { feedbackDirectoryId } = await checkFeedbackDirectoryAccess({
        feedbackDirectoryId: parsedInput.feedbackDirectoryId,
        organizationId,
        workspaceId,
        userId: ctx.user.id,
        source: "charts.getDimensionValuesAction",
      });

      const { dimension, search } = parsedInput;

      const query: TChartQuery = {
        dimensions: [dimension],
        order: [[dimension, "asc"]],
        limit: DIMENSION_VALUE_LOOKUP_LIMIT,
        ...(search ? { filters: [{ member: dimension, operator: "contains", values: [search] }] } : {}),
      };

      const rows = await executeTenantScopedQuery({
        query,
        feedbackDirectoryId,
        workspaceId,
        organizationId,
        userId: ctx.user.id,
        source: "charts.getDimensionValuesAction",
      });

      const seen = new Set<string>();
      const values: string[] = [];
      for (const row of Array.isArray(rows) ? rows : []) {
        const raw = (row as Record<string, unknown>)[dimension];
        if (typeof raw !== "string") continue;
        const value = raw.trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        values.push(value);
      }

      return values;
    }
  );
