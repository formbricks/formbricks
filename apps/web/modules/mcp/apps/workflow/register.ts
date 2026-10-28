import type { McpServer } from "@modelcontextprotocol/server";
import { registerMcpAppResource } from "../register-app-resource";

// Resource only for now: the tool that renders this view is added with the view itself.
export function registerWorkflowApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "workflow",
    title: "Workflow",
    description: "See a workflow's steps and its recent runs.",
  });
}
