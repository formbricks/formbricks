import type { McpServer } from "@modelcontextprotocol/server";
import { registerMcpAppResource } from "../register-app-resource";

// Resource only for now: the tool that renders this view is added with the view itself.
export function registerFeedbackChartApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "feedback-chart",
    title: "Feedback chart",
    description: "Chart the result of a feedback query.",
  });
}
