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
import { type TCubeRow, splitMultiSelectRows } from "@/modules/ee/analysis/charts/lib/multi-select-split";
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

interface TResolvedElement {
  elementId: string;
  surveyId: string;
}

interface TOptionGroupingResult {
  rewrittenQuery: TChartQuery;
  optionLabels?: Record<string, string>;
  splitMultiSelect?: boolean;
}

/** Find the mapping that owns this elementId and return its element/survey pair. */
const resolveElementByFieldId = async (
  fieldId: string,
  workspaceId: string
): Promise<TResolvedElement | undefined> => {
  const feedbackSources = await getFeedbackSourcesWithMappings(workspaceId);
  for (const source of feedbackSources) {
    const mapping = source.formbricksMappings.find((m) => m.elementId === fieldId);
    if (mapping) {
      return { elementId: fieldId, surveyId: mapping.surveyId };
    }
  }
  return undefined;
};

/**
 * A mapping's effective label is customFieldLabel if set, otherwise the element's
 * default-language headline (mirroring how transform.ts computes field_label on ingest).
 */
const getMappingEffectiveLabel = async (
  mapping: { elementId: string; surveyId: string; customFieldLabel?: string | null },
  loadSurvey: (surveyId: string) => Promise<Awaited<ReturnType<typeof getSurvey>> | undefined>
): Promise<string | undefined> => {
  // Fast path: customFieldLabel is already stored on the mapping. Even if it doesn't match,
  // skip the survey load because the effective label is the custom one, not the headline.
  if (mapping.customFieldLabel !== null && mapping.customFieldLabel !== undefined) {
    return mapping.customFieldLabel;
  }

  const survey = await loadSurvey(mapping.surveyId);
  if (!survey) return undefined;
  const elements = getElementsFromBlocks(survey.blocks);
  const element = elements.find((el) => el.id === mapping.elementId);
  if (!element) return undefined;
  return getTextContent(getLocalizedValue(element.headline ?? {}, "default"));
};

/**
 * Users filter by "Question" (fieldLabel) rather than the internal fieldId, so we resolve the
 * label → elementId by matching each mapping's effective label. If zero or multiple mappings
 * share the same label (ambiguous), returns undefined rather than guessing.
 */
const resolveElementByFieldLabel = async (
  fieldLabelFilter: string,
  workspaceId: string
): Promise<TResolvedElement | undefined> => {
  const feedbackSources = await getFeedbackSourcesWithMappings(workspaceId);

  // Dedupe survey loads so we only call getSurvey once per distinct surveyId.
  const surveyCache = new Map<string, Awaited<ReturnType<typeof getSurvey>>>();
  const loadSurvey = async (surveyId: string) => {
    if (!surveyCache.has(surveyId)) {
      surveyCache.set(surveyId, await getSurvey(surveyId));
    }
    return surveyCache.get(surveyId);
  };

  // Collect candidates: mappings whose effective label exactly matches the filter value.
  const candidates: TResolvedElement[] = [];
  for (const source of feedbackSources) {
    for (const mapping of source.formbricksMappings) {
      const effectiveLabel = await getMappingEffectiveLabel(mapping, loadSurvey);
      if (effectiveLabel === fieldLabelFilter) {
        candidates.push({ elementId: mapping.elementId, surveyId: mapping.surveyId });
      }
    }
  }

  // Ambiguity guard: if zero or multiple mappings share this label, do not guess.
  return candidates.length === 1 ? candidates[0] : undefined;
};

/**
 * MultipleChoiceSingle: effective dimension is valueId. Ensure the dimension is valueId
 * regardless of what the user picked (keep valueId as-is, swap valueText for it) and build
 * the choice-id → default-language label map for the renderer.
 */
const buildSingleChoiceRewrite = (
  query: TChartQuery,
  dimensions: string[],
  element: { choices: { id: string; label: TSurveyElementChoice["label"] }[] }
): TOptionGroupingResult => {
  const optionLabels: Record<string, string> = {};
  for (const choice of element.choices) {
    optionLabels[choice.id] = getChoiceLabelDefault(choice);
  }

  const rewrittenQuery: TChartQuery = {
    ...query,
    dimensions: dimensions.map((d) => (d === "FeedbackRecords.valueText" ? "FeedbackRecords.valueId" : d)),
  };

  return { rewrittenQuery, optionLabels };
};

/**
 * MultipleChoiceMulti: effective dimension is valueText — no per-option value_id is stored
 * for multi-select yet (blocked on a hub change). If the user selected valueId, swap it back
 * to valueText so Cube groups by the joined text string that the splitter can parse.
 */
const buildMultiChoiceRewrite = (
  query: TChartQuery,
  dimensions: string[],
  hasValueId: boolean
): TOptionGroupingResult => {
  const rewrittenQuery: TChartQuery = hasValueId
    ? {
        ...query,
        dimensions: dimensions.map((d) =>
          d === "FeedbackRecords.valueId" ? "FeedbackRecords.valueText" : d
        ),
      }
    : query;
  return { rewrittenQuery, splitMultiSelect: true };
};

/**
 * When a query groups by either `FeedbackRecords.valueText` or `FeedbackRecords.valueId`, and a
 * `FeedbackRecords.fieldId equals <id>` or `FeedbackRecords.fieldLabel equals <label>` filter is
 * present, inspect the element type and apply the appropriate grouping strategy:
 *
 * - MultipleChoiceSingle: effective dimension is `FeedbackRecords.valueId` (rewrite valueText →
 *   valueId if needed; keep valueId as-is). Return a `{ [value_id]: defaultLabel }` map for the
 *   renderer so slices display human-readable option labels.
 *
 * - MultipleChoiceMulti: effective dimension is `FeedbackRecords.valueText` (rewrite valueId →
 *   valueText if needed — no per-option value_id is stored yet). Set `splitMultiSelect: true` so
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
): Promise<TOptionGroupingResult> {
  const dimensions = query.dimensions ?? [];
  const hasValueText = dimensions.includes("FeedbackRecords.valueText");
  const hasValueId = dimensions.includes("FeedbackRecords.valueId");
  if (!hasValueText && !hasValueId) {
    return { rewrittenQuery: query };
  }

  // ── Resolve element via fieldId (preferred) or fieldLabel (fallback) ──────
  const fieldId = extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldId");
  const fieldLabelFilter = fieldId
    ? undefined
    : extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldLabel");

  let resolved: TResolvedElement | undefined;
  if (fieldId) {
    resolved = await resolveElementByFieldId(fieldId, workspaceId);
  } else if (fieldLabelFilter) {
    resolved = await resolveElementByFieldLabel(fieldLabelFilter, workspaceId);
  }
  if (!resolved) {
    return { rewrittenQuery: query };
  }
  const { elementId, surveyId } = resolved;

  const survey = await getSurvey(surveyId);
  if (!survey) {
    return { rewrittenQuery: query };
  }

  const elements = getElementsFromBlocks(survey.blocks);
  const element = elements.find((el) => el.id === elementId);
  if (!element) {
    return { rewrittenQuery: query };
  }

  if (element.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
    return buildSingleChoiceRewrite(
      query,
      dimensions,
      element as { choices: { id: string; label: TSurveyElementChoice["label"] }[] }
    );
  }

  if (element.type === TSurveyElementTypeEnum.MultipleChoiceMulti) {
    return buildMultiChoiceRewrite(query, dimensions, hasValueId);
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

      let rows: TCubeRow[] = Array.isArray(rawRows) ? rawRows : [];

      if (splitMultiSelect) {
        // Derive measure keys generically from the query so we don't hardcode only count.
        const measureKeys = rewrittenQuery.measures ?? [];
        rows = splitMultiSelectRows(rows, "FeedbackRecords.valueText", measureKeys);
      }

      return { rows, ...(optionLabels ? { optionLabels } : {}), effectiveQuery: rewrittenQuery };
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

      const { chartType, query, name } = await generateAIChartQuery({
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
        // Prefills the chart-name input (only when the user hasn't typed a name).
        suggestedName: name,
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
