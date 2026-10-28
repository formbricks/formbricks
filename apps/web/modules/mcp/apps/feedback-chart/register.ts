import type { McpServer } from "@modelcontextprotocol/server";
import { registerScopedTool } from "../../tools/guard-scopes";
import { registerMcpAppResource } from "../register-app-resource";
import { buildMcpAppToolMeta } from "../tool-meta";
import { ZMcpShowFeedbackChartOutput } from "./output-schema";
import {
  type TMcpShowFeedbackChartInput,
  ZMcpShowFeedbackChartInput,
  showFeedbackChart,
} from "./show-feedback-chart";

export function registerFeedbackChartApp(server: McpServer): void {
  // No CSP declared: the view draws its own SVG and only talks to the host (postMessage), so the spec's
  // default applies: no network, no external scripts, styles, images or fonts.
  registerMcpAppResource(server, {
    view: "feedback-chart",
    title: "Feedback chart",
    description: "Chart the result of a feedback query: bar, line, area, pie, a single number or a table.",
  });

  registerScopedTool(
    server,
    "show_feedback_chart",
    {
      title: "Show feedback chart",
      description: [
        "Run a feedback query and show the result as a chart in an interactive view: a line for a time axis, a bar for one dimension, a number for a single value, or a table.",
        "Takes the same workspaceId, datasetId and query as query_feedback (fields come from get_feedback_field_catalog; call that first), plus an optional chart hint { type, x, y, series, title } that is checked against the query's own fields.",
        "Read-only. The result also lists the top rows as text, so you can describe the finding without the picture; use query_feedback when you only need the numbers.",
      ].join(" "),
      inputSchema: ZMcpShowFeedbackChartInput,
      outputSchema: ZMcpShowFeedbackChartOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: buildMcpAppToolMeta("feedback-chart"),
    },
    // The scope of query_feedback: a chart is an aggregate of the same records.
    ["feedbackRecords:read"],
    async (input: TMcpShowFeedbackChartInput, mcpCtx) => showFeedbackChart(input, mcpCtx)
  );
}
