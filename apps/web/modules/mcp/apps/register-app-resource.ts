import type { McpServer } from "@modelcontextprotocol/server";
import { type ViewName, getViewHtml } from "@formbricks/mcp-views";
import { MCP_APP_MIME_TYPE, type McpUiResourceMeta, getMcpAppResourceUri } from "./constants";

interface AppResourceOptions {
  view: ViewName;
  title: string;
  description: string;
  /**
   * `_meta.ui` for this view. Called on every read, so a view that needs the instance's own origin in its
   * CSP (the survey preview loads the renderer from the deployment) can compute it from the environment.
   * Without it the host applies the spec's default CSP: no network, inline scripts and styles only.
   */
  getUiMeta?: () => McpUiResourceMeta;
}

/**
 * Serves one built view as a `ui://formbricks/<view>.html` resource with the MCP Apps MIME type.
 *
 * Resources are deliberately not scope-gated: the document is static code with no tenant data, and the
 * MCP route has already authenticated the caller. Everything a view shows arrives through tool results,
 * which are gated per tool.
 */
export function registerMcpAppResource(server: McpServer, options: AppResourceOptions): void {
  const uri = getMcpAppResourceUri(options.view);

  server.registerResource(
    options.title,
    uri,
    {
      title: options.title,
      description: options.description,
      mimeType: MCP_APP_MIME_TYPE,
    },
    async () => {
      const uiMeta = options.getUiMeta?.();
      return {
        contents: [
          {
            uri,
            mimeType: MCP_APP_MIME_TYPE,
            text: await getViewHtml(options.view),
            ...(uiMeta ? { _meta: { ui: uiMeta } } : {}),
          },
        ],
      };
    }
  );
}
