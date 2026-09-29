import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import type { TV3Authentication } from "./types";

/**
 * Which surface issued a v3 request: the dashboard (a session), a plain API call (an API key), or an
 * MCP tool. The MCP tools build their context with the MCP route as the problem-document `instance`,
 * which is the one thing that distinguishes them from a plain API call made with the same key.
 *
 * Shared by the workflows analytics and the responses metrics so the two never disagree about what
 * "via MCP" means.
 */
export type TV3RequestVia = "ui" | "api" | "mcp";

export const resolveV3RequestVia = (authentication: TV3Authentication, instance: string): TV3RequestVia => {
  if (instance === MCP_API_ROUTE) return "mcp";
  if (authentication && "apiKeyId" in authentication) return "api";
  return "ui";
};
