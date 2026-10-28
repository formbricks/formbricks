import type { McpServer } from "@modelcontextprotocol/server";
import { registerMcpAppResource } from "../register-app-resource";

// Resource only for now: the tool that renders this view is added with the view itself.
export function registerSurveyPreviewApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "survey-preview",
    title: "Survey preview",
    description: "Review a survey and try it before it goes live.",
  });
}
