import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getAiModel } from "@formbricks/ai";
import { type TChartQuery } from "@formbricks/types/analysis";
import { env } from "@/lib/env";
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

const ZAIQueryResponse = z.object({
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
  filters: z
    .array(
      z.object({
        member: ZFilterMemberId,
        operator: z.enum([
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
        ]),
        values: z.array(z.string()).nullable(),
      })
    )
    .nullable(),
});

type AIQueryResponse = z.infer<typeof ZAIQueryResponse>;

export type AIChartQueryResult = {
  chartType: TChartType;
  query: TChartQuery;
};

/**
 * Translate a natural-language prompt into a normalized Cube.js chart query.
 * Throws an InvalidInputError carrying a stable AI chart error code when
 * structured output cannot be generated; provider/config/network failures
 * stay on the existing error path.
 */
export const generateAIChartQuery = async (prompt: string): Promise<AIChartQueryResult> => {
  const schemaContext = generateSchemaContext();

  let output: AIQueryResponse;
  try {
    const response = await generateText({
      model: getAiModel(env),
      output: Output.object({ schema: ZAIQueryResponse }),
      system: schemaContext,
      // JSON.stringify escapes embedded quotes and newlines so a hostile prompt
      // cannot break out of the "User request:" framing and inject instructions.
      prompt: `User request: ${JSON.stringify(prompt)}`,
      temperature: 0,
    });
    output = response.output;
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

  return { chartType: output.chartType, query };
};
