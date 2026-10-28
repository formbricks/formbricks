import type { ViewName } from "@formbricks/mcp-views";
import { type McpAppVisibility, getMcpAppResourceUri } from "./constants";

/**
 * `_meta` for a tool whose result renders a view (spec §"Tool Metadata").
 *
 * `ui.resourceUri` is the normative link. The flat `ui/resourceUri` key is the spec's deprecated form
 * ("will be removed before GA") and `openai/outputTemplate` is ChatGPT's documented alias for the same
 * link; both are written so hosts that predate or extend the nested form still render the view. A host
 * without MCP Apps support ignores all three and gets the tool's ordinary text result.
 *
 * `visibility` defaults to the spec default (`["model", "app"]`) when omitted.
 */
export const buildMcpAppToolMeta = (
  view: ViewName,
  options: { visibility?: McpAppVisibility[] } = {}
): Record<string, unknown> => {
  const resourceUri = getMcpAppResourceUri(view);
  return {
    ui: { resourceUri, ...(options.visibility ? { visibility: options.visibility } : {}) },
    "ui/resourceUri": resourceUri,
    "openai/outputTemplate": resourceUri,
  };
};

/**
 * `_meta` for a tool only a view may call (its follow-up reads and refreshes). The host must not list it
 * to the model and must reject any other caller; the scope gate in `registerScopedTool` still applies to
 * the view's own grant, because the call goes through the same connection and authorization.
 */
export const buildMcpAppOnlyToolMeta = (): Record<string, unknown> => ({
  ui: { visibility: ["app"] satisfies McpAppVisibility[] },
});
