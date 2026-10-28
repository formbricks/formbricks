import type { McpServer } from "@modelcontextprotocol/server";
import { registerScopedTool } from "../../tools/guard-scopes";
import { registerMcpAppResource } from "../register-app-resource";
import { buildMcpAppToolMeta } from "../tool-meta";
import { ZMcpShowWorkflowOutput } from "./output-schema";
import { type TMcpShowWorkflowInput, ZMcpShowWorkflowInput, showWorkflow } from "./show-workflow";

export function registerWorkflowApp(server: McpServer): void {
  // No CSP declared: the view only talks to the host (postMessage), so the spec's default applies.
  registerMcpAppResource(server, {
    view: "workflow",
    title: "Workflow",
    description: "See a workflow's steps and its recent runs.",
  });

  registerScopedTool(
    server,
    "show_workflow",
    {
      title: "Show workflow",
      description: [
        "Show a Formbricks workflow in an interactive view: its trigger, conditions and actions as a flow, its status, and its most recent runs with step-by-step outcomes.",
        "Use it to explain how a workflow works or how it is doing. It changes nothing; enable, disable and test stay separate tools.",
        "Use get_workflow when you need the raw definition without the view.",
      ].join(" "),
      inputSchema: ZMcpShowWorkflowInput,
      outputSchema: ZMcpShowWorkflowOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: buildMcpAppToolMeta("workflow"),
    },
    ["workflows:read"],
    async (input: TMcpShowWorkflowInput, mcpCtx) => showWorkflow(input, mcpCtx)
  );
}
