import type { McpServer } from "@modelcontextprotocol/server";
import {
  archiveV3Creative,
  createV3Creative,
  deleteV3Creative,
  duplicateV3Creative,
  getV3Creative,
  getV3CreativeStats,
  listV3Creatives,
  patchV3Creative,
  restoreV3Creative,
} from "@/app/api/v3/creatives/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  ZMcpCreativeDeleteOutput,
  ZMcpCreativeListOutput,
  ZMcpCreativeOutput,
  ZMcpCreativeStatsOutput,
} from "./creative-output-schemas";
import {
  type TMcpCreateCreativeInput,
  type TMcpCreativeIdInput,
  type TMcpGetCreativeStatsInput,
  type TMcpListCreativesInput,
  type TMcpPatchCreativeInput,
  ZMcpCreateCreativeInput,
  ZMcpCreativeIdInput,
  ZMcpGetCreativeStatsInput,
  ZMcpListCreativesInput,
  ZMcpPatchCreativeInput,
} from "./creative-schemas";
import { registerScopedTool } from "./guard-scopes";
import { runMcpMutation } from "./run-mcp-mutation";

/**
 * MCP tools over the v3 Creatives API (ENG-4004) — one per documented operation.
 *
 * Every tool is a thin adapter: it maps its input onto the operation and relays the answer, so what an
 * agent can do here is exactly what an API key can do over HTTP, and validation, status rules and
 * tenancy are tested once, at `app/api/v3/creatives/lib/operations.test.ts`.
 *
 * **There is no `creatives:*` scope** (ADR 0009). Reads gate on `surveys:read` and writes on
 * `surveys:write`, so any client already allowed to manage surveys can manage creatives and nothing new
 * is asked at consent; the workspace permission behind the operation is a separate gate. Splitting the
 * scope later is additive.
 */

/** Read tools: no side effects, safe to repeat, reaching data this server does not itself own. */
const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** The context every tool derives the same way, so no tool invents its own request id. */
const toolContext = (ctx: TMcpToolContext) => {
  const authInfo = getMcpToolAuthInfo(ctx);
  const requestId = getMcpRequestId(authInfo);

  return { authentication: getMcpAuthentication(authInfo), requestId, instance: MCP_API_ROUTE };
};

export function buildListCreativesSearchParams(input: TMcpListCreativesInput): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", input.workspaceId);
  searchParams.set("limit", String(input.limit ?? 20));

  if (input.cursor) {
    searchParams.set("cursor", input.cursor);
  }

  if (input.surveyId) {
    searchParams.set("surveyId", input.surveyId);
  }

  if (input.sortBy) {
    searchParams.set("sortBy", input.sortBy);
  }

  if (input.filter?.name?.contains) {
    searchParams.set("filter[name][contains]", input.filter.name.contains);
  }

  input.filter?.type?.in?.forEach((type) => {
    searchParams.append("filter[type][in]", type);
  });

  input.filter?.displayStatus?.in?.forEach((displayStatus) => {
    searchParams.append("filter[displayStatus][in]", displayStatus);
  });

  return searchParams;
}

/** The tool goes through anyway; the dashboard confirms first (review fix A1). */
const LAST_OPENER_NOTE =
  "If this was the last creative that opens a live app survey with no actions of its own, that survey then shows nowhere until a creative or an action opens it again.";

export function registerCreativeTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_creatives",
    {
      title: "List creatives",
      description:
        "List the creatives (feedback buttons and banners the web SDK shows on a customer's site) in a workspace, newest update first. Archived ones are left out unless filter.displayStatus asks for them.",
      inputSchema: ZMcpListCreativesInput,
      outputSchema: ZMcpCreativeListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["surveys:read"],
    async (input: TMcpListCreativesInput, ctx) => {
      const context = toolContext(ctx);
      const response = await listV3Creatives({
        searchParams: buildListCreativesSearchParams(input),
        ...context,
      });

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "get_creative",
    {
      title: "Get creative",
      description:
        "Get one creative in full: content, styling, Destination, distribution, schedule, derived displayStatus and any warnings.",
      inputSchema: ZMcpCreativeIdInput,
      outputSchema: ZMcpCreativeOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["surveys:read"],
    async (input: TMcpCreativeIdInput, ctx) => {
      const context = toolContext(ctx);
      const response = await getV3Creative({ creativeId: input.creativeId, ...context });

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "get_creative_stats",
    {
      title: "Get creative stats",
      description:
        "Read a creative's Impressions, Clicks and Click rate per UTC day, optionally grouped by page or device type. Counts lag by about a minute.",
      inputSchema: ZMcpGetCreativeStatsInput,
      outputSchema: ZMcpCreativeStatsOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["surveys:read"],
    async (input: TMcpGetCreativeStatsInput, ctx) => {
      const context = toolContext(ctx);
      const response = await getV3CreativeStats({
        creativeId: input.creativeId,
        query: { from: input.from, to: input.to, groupBy: input.groupBy },
        ...context,
      });

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "create_creative",
    {
      title: "Create creative",
      description:
        "Create a creative: a feedback button or banner the web SDK shows on the customer's site. Created as a draft unless `status` is inProgress, which publishes it and so needs its Destination (a survey or a link) and non-empty default-language text; a breach answers 422 naming the field. Texts are keyed by locale code.",
      inputSchema: ZMcpCreateCreativeInput,
      outputSchema: ZMcpCreativeOutput,
      audit: { action: "created", targetType: "creative" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpCreateCreativeInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "creative", logContext: { workspaceId: input.workspaceId } },
        ({ authentication, requestId, auditLog }) =>
          createV3Creative({ body: input, authentication, requestId, instance: MCP_API_ROUTE, auditLog })
      )
  );

  registerScopedTool(
    server,
    "patch_creative",
    {
      title: "Patch creative",
      description: [
        "Update a creative. Each group in `data` (content, styling, destination, distribution, schedule, or defaultLanguage with languages) replaces the stored group as a whole, so send it complete: read it with get_creative first.",
        "Publish, pause, close and reopen by setting `status`; a published creative cannot go back to draft.",
        "An archived creative is read-only: restore_creative first.",
        `Changing or removing the destination: ${LAST_OPENER_NOTE}`,
      ].join(" "),
      inputSchema: ZMcpPatchCreativeInput,
      outputSchema: ZMcpCreativeOutput,
      audit: { action: "updated", targetType: "creative", targetIdArg: "creativeId" },
      annotations: {
        readOnlyHint: false,
        // A group is replaced whole, so what it held is gone unless the caller kept the earlier read.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpPatchCreativeInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "creative", logContext: { creativeId: input.creativeId } },
        ({ authentication, requestId, auditLog }) =>
          patchV3Creative({
            creativeId: input.creativeId,
            body: input.data,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "delete_creative",
    {
      title: "Delete creative",
      description: `Permanently delete a creative and its counts. To take one off the site and keep its history, use archive_creative. ${LAST_OPENER_NOTE}`,
      inputSchema: ZMcpCreativeIdInput,
      outputSchema: ZMcpCreativeDeleteOutput,
      audit: { action: "deleted", targetType: "creative", targetIdArg: "creativeId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpCreativeIdInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "deleted", resource: "creative", logContext: { creativeId: input.creativeId } },
        ({ authentication, requestId, auditLog }) =>
          deleteV3Creative({
            creativeId: input.creativeId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "duplicate_creative",
    {
      title: "Duplicate creative",
      description:
        "Copy a creative into a new draft named '<name> (copy)', without its counts. A Destination survey that can no longer be one is dropped.",
      inputSchema: ZMcpCreativeIdInput,
      outputSchema: ZMcpCreativeOutput,
      audit: { action: "created", targetType: "creative" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpCreativeIdInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "creative", logContext: { creativeId: input.creativeId } },
        ({ authentication, requestId, auditLog }) =>
          duplicateV3Creative({
            creativeId: input.creativeId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "archive_creative",
    {
      title: "Archive creative",
      description: `Set a creative aside: it stops showing, leaves the default list and becomes read-only, and keeps its counts. restore_creative brings it back as a draft, to publish again. ${LAST_OPENER_NOTE}`,
      inputSchema: ZMcpCreativeIdInput,
      outputSchema: ZMcpCreativeOutput,
      audit: { action: "archived", targetType: "creative", targetIdArg: "creativeId" },
      annotations: {
        readOnlyHint: false,
        // Restorable, and archiving an archived creative changes nothing.
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpCreativeIdInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "archived", resource: "creative", logContext: { creativeId: input.creativeId } },
        ({ authentication, requestId, auditLog }) =>
          archiveV3Creative({
            creativeId: input.creativeId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "restore_creative",
    {
      title: "Restore creative",
      description:
        "Bring an archived creative back, always as a draft whatever status it had: to show it again, publish it with patch_creative (status). A survey that can no longer be its Destination is unlinked.",
      inputSchema: ZMcpCreativeIdInput,
      outputSchema: ZMcpCreativeOutput,
      audit: { action: "restored", targetType: "creative", targetIdArg: "creativeId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpCreativeIdInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "restored", resource: "creative", logContext: { creativeId: input.creativeId } },
        ({ authentication, requestId, auditLog }) =>
          restoreV3Creative({
            creativeId: input.creativeId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}
