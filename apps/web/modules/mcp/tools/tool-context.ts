import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";

/**
 * Pieces every tool module needs, kept in one place so a module cannot invent its own request id or
 * annotate a read differently from the rest.
 */

/** Read tools: no side effects, safe to repeat, reaching data this server does not itself own. */
export const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** Write tools that create or change something, never delete it, and are not safe to repeat blindly. */
export const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

/**
 * Write tools that overwrite or remove something already there — an update, a rearrange, taking a chart off
 * a dashboard — as the survey and workflow update tools are marked, so a client can ask before running one.
 */
export const DESTRUCTIVE_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;

/** The context every tool derives the same way, so no tool invents its own request id. */
export const toolContext = (ctx: TMcpToolContext) => {
  const authInfo = getMcpToolAuthInfo(ctx);
  const requestId = getMcpRequestId(authInfo);

  return { authentication: getMcpAuthentication(authInfo), requestId, instance: MCP_API_ROUTE };
};
