import "server-only";
import { z } from "zod";
import { type TChartQuery } from "@formbricks/types/analysis";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { generateSchemaContext } from "@/modules/ee/analysis/lib/ai-schema-context";
import {
  FEEDBACK_DIMENSION_IDS,
  FEEDBACK_MEASURE_IDS,
  FEEDBACK_TIME_DIMENSION_IDS,
} from "@/modules/ee/analysis/lib/schema-definition";
import { type TChartType, ZChartType } from "@/modules/ee/analysis/types/analysis";
import { getAIChartPromptError } from "./ai-chart-errors.server";

const CUBE_NAME = "FeedbackRecords";
const DEFAULT_MEASURE = `${CUBE_NAME}.count`;
const AI_CHART_GENERATION_TIMEOUT_MS = 30_000;
const AI_CHART_GENERATION_MAX_OUTPUT_TOKENS = 1024;
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
        dateRange: z.string().nullable(),
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
  prompt,
}: GenerateAIChartQueryInput): Promise<AIChartQueryResult> => {
  const schemaContext = generateSchemaContext();

  let output: AIQueryResponse;
  try {
    const response = await generateOrganizationAIObject<AIQueryResponse>({
      organizationId,
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
    query.timeDimensions = output.timeDimensions.map(({ dimension, granularity, dateRange }) => ({
      dimension,
      ...(granularity == null ? {} : { granularity }),
      ...(dateRange == null ? {} : { dateRange }),
    }));
  }

  const result: AIChartQueryResult = { chartType: output.chartType, query };

  const name = output.name?.trim();
  if (name) {
    result.name = name.slice(0, MAX_CHART_NAME_LENGTH);
  }

  return result;
};
