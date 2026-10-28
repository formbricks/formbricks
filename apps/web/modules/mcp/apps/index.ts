import type { McpServer } from "@modelcontextprotocol/server";
import { registerCreativePreviewApp } from "./creative-preview/register";
import { registerDocumentReviewApp } from "./document-review/register";
import { registerFeedbackChartApp } from "./feedback-chart/register";
import { registerResponsesApp } from "./responses/register";
import { registerSurveyPreviewApp } from "./survey-preview/register";
import { registerWorkflowApp } from "./workflow/register";

/**
 * Registers every MCP App: the views (`ui://` resources) and the tools that render them. Tool-side
 * registration lives next to each view; see docs/development/technical-handbook/mcp-server.mdx, "Adding a
 * view".
 */
export function registerMcpApps(server: McpServer): void {
  registerSurveyPreviewApp(server);
  registerDocumentReviewApp(server);
  registerFeedbackChartApp(server);
  registerResponsesApp(server);
  registerCreativePreviewApp(server);
  registerWorkflowApp(server);
}
