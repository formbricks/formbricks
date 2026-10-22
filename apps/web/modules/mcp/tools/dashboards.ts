import type { McpServer } from "@modelcontextprotocol/server";
import { getV3ChartFieldCatalog } from "@/app/api/v3/charts/lib/field-operations";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpListChartFieldsInput,
  ZMcpChartFieldCatalogOutput,
  ZMcpListChartFieldsInput,
} from "./dashboard-schemas";
import { registerScopedTool } from "./guard-scopes";
import { READ_ANNOTATIONS, toolContext } from "./tool-context";

/**
 * MCP tools over the v3 chart and dashboard operations — one tool per operation, so an agent can do
 * exactly what an API key can do over HTTP, minus deletion: there is no delete tool, so a vague prompt
 * like "clean up old charts" cannot remove anything permanently.
 *
 * Definitions and the field catalog need `dashboards:read`. Reading a chart's numbers also needs
 * `feedbackRecords:read`, so a dashboards grant never becomes a way into respondents' answers.
 */
export function registerDashboardTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_chart_fields",
    {
      title: "List chart fields",
      description: [
        "List the fields a chart query may use on a Feedback Dataset: each field's name, kind (measure, dimension, timeDimension), type, label, description, filter operators and granularities, plus the date presets.",
        "Call this before writing a chart query. Use the names exactly as listed, prefix included (FeedbackRecords.npsScore); a field not listed is refused.",
      ].join(" "),
      inputSchema: ZMcpListChartFieldsInput,
      outputSchema: ZMcpChartFieldCatalogOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["dashboards:read"],
    async (input: TMcpListChartFieldsInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await getV3ChartFieldCatalog({ ...input, ...context }),
        context.requestId
      );
    }
  );
}
