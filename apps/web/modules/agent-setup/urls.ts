import "server-only";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import type { TSetupGuideUrls } from "./setup-guide";

export const SETUP_GUIDE_PATH = "/agents/setup.md";

const MCP_PATH_SUFFIX = "/api/mcp";

/**
 * The instance's web app URL, derived from the MCP resource URL so that it carries the same custom
 * subpath and origin handling (`oauth-urls.ts`) as the rest of the MCP surface.
 */
export const getBaseUrlFromMcpUrl = (mcpUrl: string): string =>
  mcpUrl.endsWith(MCP_PATH_SUFFIX) ? mcpUrl.slice(0, -MCP_PATH_SUFFIX.length) : mcpUrl;

export const getSetupGuideUrls = (): TSetupGuideUrls => {
  const mcpUrl = getMcpResourceUrl();
  return { baseUrl: getBaseUrlFromMcpUrl(mcpUrl), mcpUrl };
};

export const getSetupGuideUrl = (): string => `${getSetupGuideUrls().baseUrl}${SETUP_GUIDE_PATH}`;
