import type { McpServer } from "@modelcontextprotocol/server";
import { registerMcpAppResource } from "../register-app-resource";

// Resource only for now: the tool that renders this view is added with the view itself.
export function registerDocumentReviewApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "document-review",
    title: "Change review",
    description: "Review what a document change would do, then approve it.",
  });
}
