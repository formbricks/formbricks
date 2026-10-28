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
