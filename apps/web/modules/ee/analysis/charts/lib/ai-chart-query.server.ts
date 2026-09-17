import "server-only";
import { z } from "zod";
import { type TChartQuery } from "@formbricks/types/analysis";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import { formatDataProfile } from "@/modules/ee/analysis/lib/ai-data-profile";
import { getAIDataProfile } from "@/modules/ee/analysis/lib/ai-data-profile.server";
import { generateSchemaContext } from "@/modules/ee/analysis/lib/ai-schema-context";
import {
  DATE_PRESETS,
  FEEDBACK_DIMENSION_IDS,
  FEEDBACK_MEASURE_IDS,
  FEEDBACK_TIME_DIMENSION_IDS,
} from "@/modules/ee/analysis/lib/schema-definition";
import { type TChartType, ZChartType } from "@/modules/ee/analysis/types/analysis";
import { resolveAIDateRange } from "./ai-chart-date-range";
import { getAIChartPromptError } from "./ai-chart-errors.server";
import { prepareQueryForChartType } from "./big-number";

const CUBE_NAME = "FeedbackRecords";
const DEFAULT_MEASURE = `${CUBE_NAME}.count`;
const AI_CHART_GENERATION_TIMEOUT_MS = 30_000;
/**
 * Output budget for one generation.
 *
 * This counts reasoning tokens, not just the JSON — and the answer is a query object that fits in a
 * few hundred. At 1024 a thinking model (the default `gemini-2.5-flash` deployment spent 982 of them
 * on a two-clause prompt) exhausted the budget mid-thought and threw `AIOutputTokenLimitError`
 * before writing a single field. Sized for a model that thinks, since the provider and model are
 * deployment configuration and a non-reasoning one simply never approaches the cap.
 */
const AI_CHART_GENERATION_MAX_OUTPUT_TOKENS = 8192;
// Matches the maxLength of the chart-name input and the persisted chart name.
const MAX_CHART_NAME_LENGTH = 255;

const toEnumTuple = (values: readonly string[]): [string, ...string[]] => {
  if (values.length === 0) {
    throw new Error("AI query schema requires at least one allowed id");
  }
  return [values[0], ...values.slice(1)];
};

const ZMeasureId = z.enum(toEnumTuple(FEEDBACK_MEASURE_IDS));
const ZDimensionId = z.enum(toEnumTuple(FEEDBACK_DIMENSION_IDS));
const ZTimeDimensionId = z.enum(toEnumTuple(FEEDBACK_TIME_DIMENSION_IDS));
const ZDatePreset = z.enum(toEnumTuple(DATE_PRESETS.map((preset) => preset.value)));
const ZFilterMemberId = z.enum(toEnumTuple([...FEEDBACK_MEASURE_IDS, ...FEEDBACK_DIMENSION_IDS]));
const ZFilterOperator = z.enum([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "set",
  "notSet",
  "gt",
  "gte",
  "lt",
  "lte",
]);
const VALUELESS_FILTER_OPERATORS = new Set<z.infer<typeof ZFilterOperator>>(["set", "notSet"]);

const ZFilter = z
  .object({
    member: ZFilterMemberId,
    operator: ZFilterOperator,
    values: z.array(z.string()).nullable().optional(),
  })
  .superRefine(({ operator, values }, ctx) => {
    if (VALUELESS_FILTER_OPERATORS.has(operator)) {
      if (values != null) {
        ctx.addIssue({
          code: "custom",
          message: `Filter operator "${operator}" must not include values`,
          path: ["values"],
        });
      }

      return;
    }

    if (!values?.length) {
      ctx.addIssue({
        code: "custom",
        message: `Filter operator "${operator}" requires a non-empty values array`,
        path: ["values"],
      });
    }
  });

export const ZAIQueryResponse = z.object({
  name: z
    .string()
    .nullable()
    .describe("Short, descriptive chart name reflecting the user's request (max 255 characters)"),
  measures: z.array(ZMeasureId),
  dimensions: z.array(ZDimensionId).nullable(),
  timeDimensions: z
    .array(
      z.object({
        dimension: ZTimeDimensionId,
        granularity: z.enum(["hour", "day", "week", "month", "quarter", "year"]).nullable(),
        // Three flat fields rather than one union: the preset is an enum the model cannot spell
        // wrong, the explicit pair is the escape hatch for a window no preset covers, and both
        // encode in every provider's structured-output dialect. A single `dateRange: string` is what
        // let the model answer with an ISO 8601 interval nothing downstream could read.
        // The descriptions carry the exclusivity rule because they are the only part of this that
        // reaches the model: `Output.object` sends the schema to the provider as JSON Schema, which
        // cannot express "one of these, never both". A cross-field refinement would therefore
        // constrain nothing at generation time and only turn a model that answered with both into a
        // failed request — so the rule is stated here, and `resolveAIDateRange` breaks the tie.
        dateRangePreset: ZDatePreset.nullable().describe(
          "Named range covering the request. Use this OR the explicit start/end pair, never both; prefer a preset whenever one fits. Null when giving explicit dates."
        ),
        dateRangeStart: z
          .string()
          .nullable()
          .describe(
            "Inclusive start as YYYY-MM-DD. Only when no preset covers the request, and only with dateRangePreset null and dateRangeEnd also given."
          ),
        dateRangeEnd: z
          .string()
          .nullable()
          .describe(
            "Inclusive end as YYYY-MM-DD. Only when no preset covers the request, and only with dateRangePreset null and dateRangeStart also given."
          ),
      })
    )
    .nullable(),
  chartType: ZChartType,
  filters: z.array(ZFilter).nullable(),
});

type AIQueryResponse = z.infer<typeof ZAIQueryResponse>;

export type AIChartQueryResult = {
  chartType: TChartType;
  query: TChartQuery;
  /** AI-suggested chart name; omitted when the model returns none. */
  name?: string;
};

type GenerateAIChartQueryInput = {
  organizationId: string;
  workspaceId: string;
  feedbackDirectoryId: string;
  userId: string;
  prompt: string;
};

/**
 * Translate a natural-language prompt into a normalized Cube.js chart query.
 * Throws an InvalidInputError carrying a stable AI chart error code when
 * structured output cannot be generated; provider/config/network failures
 * stay on the existing error path.
 */
export const generateAIChartQuery = async ({
  organizationId,
  workspaceId,
  feedbackDirectoryId,
  userId,
  prompt,
}: GenerateAIChartQueryInput): Promise<AIChartQueryResult> => {
  // What the cube *could* hold, then what this directory actually does. The second half is what
  // stops the model filtering on a source name it invented; it is best-effort, and an empty string
  // leaves the schema-only prompt this feature shipped with.
  const dataProfile = await getAIDataProfile({
    feedbackDirectoryId,
    workspaceId,
    organizationId,
    userId,
  });
  const schemaContext = [generateSchemaContext(), formatDataProfile(dataProfile)]
    .filter((section) => section.length > 0)
    .join("\n\n");

  let output: AIQueryResponse;
  try {
    const response = await generateOrganizationAIObject<AIQueryResponse>({
      organizationId,
      aiTracing: { distinctId: userId, feature: AI_TRACING_FEATURE.ChartQuery, workspaceId },
      schema: ZAIQueryResponse,
      system: schemaContext,
      // JSON.stringify escapes embedded quotes and newlines so a hostile prompt
      // cannot break out of the "User request:" framing and inject instructions.
      prompt: `User request: ${JSON.stringify(prompt)}`,
      temperature: 0,
      maxOutputTokens: AI_CHART_GENERATION_MAX_OUTPUT_TOKENS,
      timeout: AI_CHART_GENERATION_TIMEOUT_MS,
    });
    output = response.object;
  } catch (error) {
    const promptError = getAIChartPromptError(error);
    if (promptError) {
      throw promptError;
    }

    throw error;
  }

  return normalizeChartQuery(output);
};

const normalizeChartQuery = (output: AIQueryResponse): AIChartQueryResult => {
  const measures = output.measures.length > 0 ? output.measures : [DEFAULT_MEASURE];
  const query: TChartQuery = { measures };

  if (output.dimensions?.length) {
    query.dimensions = output.dimensions;
  }

  if (output.filters?.length) {
    query.filters = output.filters.map(({ member, operator, values }) => ({
      member,
      operator,
      ...(values == null ? {} : { values }),
    }));
  }

  if (output.timeDimensions?.length) {
    query.timeDimensions = output.timeDimensions.map(
      ({ dimension, granularity, dateRangePreset, dateRangeStart, dateRangeEnd }) => {
        const dateRange = resolveAIDateRange({
          preset: dateRangePreset,
          start: dateRangeStart,
          end: dateRangeEnd,
        });

        return {
          dimension,
          ...(granularity == null ? {} : { granularity }),
          ...(dateRange === undefined ? {} : { dateRange }),
        };
      }
    );
  }

  // A big number has no axis for a grouping, so the model asking for one (a granularity, a
  // dimension) is dropped rather than folded into the single value it renders.
  const result: AIChartQueryResult = {
    chartType: output.chartType,
    query: prepareQueryForChartType(query, output.chartType),
  };

  const name = output.name?.trim();
  if (name) {
    result.name = name.slice(0, MAX_CHART_NAME_LENGTH);
  }

  return result;
};
