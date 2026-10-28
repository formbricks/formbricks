import type { McpServer } from "@modelcontextprotocol/server";
import { registerMcpAppResource } from "../register-app-resource";

// Resource only for now: the tool that renders this view is added with the view itself.
export function registerResponsesApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "responses",
    title: "Responses",
    description: "Browse the responses to a survey.",
  });
}
