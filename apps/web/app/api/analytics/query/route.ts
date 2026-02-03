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

    // Clean up null/empty values to conform to CubeJS expectations
    if (
      cubeQuery.dimensions === null ||
      (Array.isArray(cubeQuery.dimensions) && cubeQuery.dimensions.length === 0)
    ) {
      delete (cubeQuery as any).dimensions;
    }
    if (!cubeQuery.filters || cubeQuery.filters.length === 0) {
      delete (cubeQuery as any).filters;
    } else {
      // Clean up null values in filters
      cubeQuery.filters = cubeQuery.filters.map((f: any) => {
        const newFilter: any = { ...f };
        if (newFilter.values === null) delete newFilter.values;
        return newFilter;
      });
    }
    if (cubeQuery.timeDimensions === null) {
      delete (cubeQuery as any).timeDimensions;
    } else if (Array.isArray(cubeQuery.timeDimensions)) {
      // Filter out null properties in timeDimensions objects
      cubeQuery.timeDimensions = cubeQuery.timeDimensions.map((td: any) => {
        const newTd: any = { ...td };
        if (newTd.granularity === null) delete newTd.granularity;
        if (newTd.dateRange === null) delete newTd.dateRange;
        return newTd;
      });
    }

    // Execute query if requested (default: true)
    let data: Record<string, any>[] | undefined;
    if (shouldExecuteQuery) {
      try {
        data = await executeQuery(cubeQuery);
      } catch (queryError: any) {
        console.error("Error executing Cube.js query:", queryError);
        // Return the query even if execution fails, so client can retry
        return NextResponse.json(
          {
            query: cubeQuery,
            chartType,
            error: `Failed to execute query: ${queryError.message || "Unknown error"}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      query: cubeQuery,
      chartType,
      data,
    });
  } catch (error: any) {
    console.error("Error generating query:", error);
    return NextResponse.json({ error: error.message || "Failed to generate query" }, { status: 500 });
  }
}
