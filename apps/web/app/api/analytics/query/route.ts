import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { executeQuery } from "../_lib/cube-client";
import { CUBE_NAME, generateSchemaContext } from "../_lib/schema-parser";

const schema = z.object({
  measures: z.array(z.string()).describe("List of measures to query"),
  dimensions: z.array(z.string()).nullable().describe("List of dimensions to query"),
  timeDimensions: z
    .array(
      z.object({
        dimension: z.string(),
        granularity: z.enum(["day", "week", "month", "year"]).nullable(),
        dateRange: z.string().nullable(),
      })
    )
    .nullable()
    .describe("Time dimensions with granularity and date range"),
  chartType: z
    .enum(["bar", "line", "donut", "kpi", "area", "pie"])
    .describe("Suggested chart type for visualization"),
  filters: z
    .array(
      z.object({
        member: z.string(),
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
    .nullable()
    .describe("Filters to apply to the query"),
});

// Generate schema context dynamically from the schema file
const SCHEMA_CONTEXT = generateSchemaContext();

// JSON Schema for OpenAI structured outputs (manually created to avoid zod-to-json-schema dependency)
const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    measures: {
      type: "array",
      items: { type: "string" },
      description: "List of measures to query",
    },
    dimensions: {
      anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
      description: "List of dimensions to query",
    },
    timeDimensions: {
      anyOf: [
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              dimension: { type: "string" },
              granularity: {
                anyOf: [{ type: "string", enum: ["day", "week", "month", "year"] }, { type: "null" }],
              },
              dateRange: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
            },
            required: ["dimension", "granularity", "dateRange"],
          },
        },
        { type: "null" },
      ],
      description: "Time dimensions with granularity and date range",
    },
    chartType: {
      type: "string",
      enum: ["bar", "line", "donut", "kpi", "area", "pie"],
      description: "Suggested chart type for visualization",
    },
    filters: {
      anyOf: [
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              member: { type: "string" },
              operator: {
                type: "string",
                enum: [
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
                ],
              },
              values: {
                anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
              },
            },
            required: ["member", "operator", "values"],
          },
        },
        { type: "null" },
      ],
      description: "Filters to apply to the query",
    },
  },
  required: ["measures", "dimensions", "timeDimensions", "chartType", "filters"],
} as const;

// Initialize OpenAI client
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export async function POST(request: NextRequest) {
  try {
    const { prompt, executeQuery: shouldExecuteQuery = true } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required and must be a string" }, { status: 400 });
    }

    const openai = getOpenAIClient();

    // Generate Cube.js query using OpenAI structured outputs
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SCHEMA_CONTEXT },
        { role: "user", content: `User request: "${prompt}"` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_cube_query",
            description: "Generate a Cube.js query based on the user request",
            parameters: jsonSchema,
            strict: true, // Enable structured outputs
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_cube_query" } },
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (toolCall?.function.name !== "generate_cube_query") {
      throw new Error("Failed to generate structured output from OpenAI");
    }

    const query = JSON.parse(toolCall.function.arguments);

    // Validate with zod schema (for type safety)
    const validatedQuery = schema.parse(query);

    // Validate required fields (measures should minimally be present if not specified, default to count)
    if (!validatedQuery.measures || validatedQuery.measures.length === 0) {
      validatedQuery.measures = [`${CUBE_NAME}.count`];
    }

    // Extract chartType (for UI purposes only, not part of CubeJS query)
    const { chartType, ...cubeQuery } = validatedQuery;

    // Build a clean query object, stripping null / empty arrays so Cube.js is happy
    const cleanQuery: Record<string, unknown> = {
      measures: cubeQuery.measures,
    };

    if (Array.isArray(cubeQuery.dimensions) && cubeQuery.dimensions.length > 0) {
      cleanQuery.dimensions = cubeQuery.dimensions;
    }

    if (Array.isArray(cubeQuery.filters) && cubeQuery.filters.length > 0) {
      cleanQuery.filters = cubeQuery.filters.map(
        (f: { member: string; operator: string; values?: string[] | null }) => {
          const cleaned: Record<string, unknown> = { member: f.member, operator: f.operator };
          if (f.values !== null && f.values !== undefined) cleaned.values = f.values;
          return cleaned;
        }
      );
    }

    if (Array.isArray(cubeQuery.timeDimensions) && cubeQuery.timeDimensions.length > 0) {
      cleanQuery.timeDimensions = cubeQuery.timeDimensions.map(
        (td: { dimension: string; granularity?: string | null; dateRange?: string | null }) => {
          const cleaned: Record<string, unknown> = { dimension: td.dimension };
          if (td.granularity !== null && td.granularity !== undefined) cleaned.granularity = td.granularity;
          if (td.dateRange !== null && td.dateRange !== undefined) cleaned.dateRange = td.dateRange;
          return cleaned;
        }
      );
    }

    // Execute query if requested (default: true)
    let data: Record<string, unknown>[] | undefined;
    if (shouldExecuteQuery) {
      try {
        data = await executeQuery(cleanQuery);
      } catch (queryError: unknown) {
        const message = queryError instanceof Error ? queryError.message : "Unknown error";
        return NextResponse.json(
          {
            query: cleanQuery,
            chartType,
            error: `Failed to execute query: ${message}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      query: cleanQuery,
      chartType,
      data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate query";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
