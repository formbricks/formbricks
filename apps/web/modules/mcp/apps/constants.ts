import type { ViewName } from "@formbricks/mcp-views";

/**
 * MCP Apps (extension `io.modelcontextprotocol/ui`, spec 2026-01-26):
 * https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
 *
 * These strings are normative parts of that spec, copied here rather than imported so the server does
 * not depend on the ext-apps package; `constants.test.ts` pins every one.
 */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

export const getMcpAppResourceUri = (view: ViewName): string => `ui://formbricks/${view}.html`;

export type McpAppVisibility = "model" | "app";

/** `_meta.ui` of a `resources/read` content item (spec §"UI Resource Format"). */
export interface McpUiResourceMeta {
  csp?: {
    /** fetch / XHR / WebSocket (`connect-src`). */
    connectDomains?: string[];
    /** Scripts, styles, images, fonts and media. */
    resourceDomains?: string[];
    /** Nested iframes (`frame-src`). */
    frameDomains?: string[];
    /** `base-uri`. */
    baseUriDomains?: string[];
  };
  permissions?: {
    camera?: Record<string, never>;
    microphone?: Record<string, never>;
    geolocation?: Record<string, never>;
    clipboardWrite?: Record<string, never>;
  };
  domain?: string;
  prefersBorder?: boolean;
}
