import type { McpServer } from "@modelcontextprotocol/server";
import { registerMcpAppResource } from "../register-app-resource";

// Resource only for now: the tool that renders this view is added with the view itself.
export function registerCreativePreviewApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "creative-preview",
    title: "Creative preview",
    description: "See how a creative looks on a page.",
  });
}
