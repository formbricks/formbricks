import type { McpServer } from "@modelcontextprotocol/server";
import { logger } from "@formbricks/logger";
import { getV3Creative } from "@/app/api/v3/creatives/lib/operations";
import { getActionClasses } from "@/lib/actionClass/service";
import { getWorkspace } from "@/lib/workspace/service";
import { compileCreativeCustomCss } from "@/modules/ee/creatives/lib/custom-css";
import { getAppliedCustomCssSource, getCreativeStyle } from "@/modules/ee/creatives/lib/style";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../../auth";
import { responseToMcpToolResult } from "../../errors";
import { ZMcpCreativeOutput } from "../../tools/creative-output-schemas";
import { type TMcpCreativeIdInput, ZMcpCreativeIdInput } from "../../tools/creative-schemas";
import { registerScopedTool } from "../../tools/guard-scopes";
import { registerMcpAppResource } from "../register-app-resource";
import { buildMcpAppToolMeta } from "../tool-meta";
import { type TCreativePreviewMeta, type TCreativeResource, buildCreativePreviewText } from "./preview";

/**
 * `show_creative`: the creative preview view. The tool reads the creative through the same v3 operation as
 * `get_creative` (so access, licence and tenancy are decided there, once) and adds what the view needs to
 * draw it as a visitor sees it: the look the SDK would apply and the names of the actions that show it.
 *
 * Both extras are looked up with ids that came out of the authorized creative (its own workspace), never
 * with an id the caller supplied. Neither can fail the call: without them the preview falls back to a
 * neutral look (flagged `styleIsExact: false`) and a count of actions instead of their names.
 *
 * The view runs under the default CSP: the renderer is bundled into it and draws from this data, so it
 * declares no domains and makes no network request of its own.
 */

const toolContext = (ctx: TMcpToolContext) => {
  const authInfo = getMcpToolAuthInfo(ctx);
  const requestId = getMcpRequestId(authInfo);

  return { authentication: getMcpAuthentication(authInfo), requestId, instance: MCP_API_ROUTE };
};

const readWorkspaceStyling = async (creative: TCreativeResource) => {
  try {
    const workspace = await getWorkspace(creative.workspaceId);
    return workspace ? { found: true as const, styling: workspace.styling } : { found: false as const };
  } catch (error) {
    logger.warn({ error, creativeId: creative.id }, "show_creative could not read the workspace styling");
    return { found: false as const };
  }
};

const readTriggerNames = async (creative: TCreativeResource): Promise<string[] | null> => {
  const ids = creative.distribution.triggers.map(({ actionClassId }) => actionClassId);
  if (creative.distribution.showOn !== "action" || ids.length === 0) return null;

  try {
    const actions = await getActionClasses(creative.workspaceId);
    const names = new Map(actions.map(({ id, name }) => [id, name]));
    // An action deleted since it was linked has no name to show; the rest still read better than a count.
    const found = ids.flatMap((id) => names.get(id) ?? []);
    return found.length > 0 ? found : null;
  } catch (error) {
    logger.warn({ error, creativeId: creative.id }, "show_creative could not read the action names");
    return null;
  }
};

export const buildCreativePreviewMeta = async (
  creative: TCreativeResource
): Promise<TCreativePreviewMeta> => {
  const customCssSource = getAppliedCustomCssSource(creative.styling.theme);
  const [workspace, triggerNames, customCss] = await Promise.all([
    readWorkspaceStyling(creative),
    readTriggerNames(creative),
    customCssSource ? compileCreativeCustomCss(creative.type, customCssSource) : null,
  ]);

  return {
    style: getCreativeStyle(creative, workspace.found ? workspace.styling : undefined, customCss),
    styleIsExact: workspace.found,
    triggerNames,
  };
};

export function registerCreativePreviewApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "creative-preview",
    title: "Creative preview",
    description: "See how a creative looks on a page.",
  });

  registerScopedTool(
    server,
    "show_creative",
    {
      title: "Show creative",
      description:
        "Show how a creative (a feedback button or banner the web SDK draws on a customer's site) looks on a page, in an interactive preview with a desktop and mobile width, light and dark pages, its display status and why, when and to whom it shows, and the survey or link it opens. Reads the same data as get_creative; use that when you only need the data and no preview.",
      inputSchema: ZMcpCreativeIdInput,
      outputSchema: ZMcpCreativeOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      _meta: buildMcpAppToolMeta("creative-preview"),
    },
    // No `creatives:*` scope exists: reads gate on `surveys:read`, like `get_creative`.
    ["surveys:read"],
    async (input: TMcpCreativeIdInput, ctx) => {
      const context = toolContext(ctx);
      const response = await getV3Creative({ creativeId: input.creativeId, ...context });
      const result = await responseToMcpToolResult(response, context.requestId);
      if (result.isError) return result;

      const parsed = ZMcpCreativeOutput.safeParse(result.structuredContent);
      if (!parsed.success || !parsed.data.data) return result;

      const creative = parsed.data.data;
      const meta = await buildCreativePreviewMeta(creative);

      return {
        ...result,
        content: [{ type: "text" as const, text: buildCreativePreviewText(creative, meta.triggerNames) }],
        _meta: { formbricks: meta },
      };
    }
  );
}
