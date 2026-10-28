import type { McpServer } from "@modelcontextprotocol/server";
import { problemInternalError } from "@/app/api/v3/lib/response";
import { listV3Responses } from "@/app/api/v3/responses/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../../auth";
import { responseToMcpToolResult } from "../../errors";
import { registerScopedTool } from "../../tools/guard-scopes";
import { ZMcpResponseListOutput } from "../../tools/response-schemas";
import { buildListResponsesSearchParams } from "../../tools/responses";
import { registerMcpAppResource } from "../register-app-resource";
import { buildMcpAppToolMeta } from "../tool-meta";
import { buildShowResponsesPayload, buildShowResponsesText } from "./build-view";
import { type TMcpShowResponsesInput, ZMcpShowResponsesInput, ZMcpShowResponsesOutput } from "./schemas";

/**
 * `show_responses` and the view it renders: a survey's responses as a table the person can filter, page
 * and open, inside the agent.
 *
 * **The view declares no CSP.** It never opens a connection of its own: follow-up pages and the detail
 * panel go through the host (`tools/call` to `list_responses` and `get_response`), so the spec's default
 * policy (`connect-src 'none'`, no external resources) is exactly what it needs. Respondent answers are
 * rendered as text only, never as markup, and never copied into the model's context by the view.
 *
 * **Same operation, same gates.** The first page comes from `listV3Responses`, the operation behind
 * `list_responses`, so authorization, tenant scoping, the survey-visibility check and the page cap are
 * the operation's, not re-implemented here. The tool needs `responses:read` and nothing more: the
 * columns come from the answers themselves (each carries its question's id, label and position), so no
 * survey fetch, and no `surveys:read`, is involved.
 */
export function registerResponsesApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "responses",
    title: "Responses",
    description: "Browse the responses to a survey.",
  });

  registerScopedTool(
    server,
    "show_responses",
    {
      title: "Show responses",
      description: [
        "Show a survey's responses to the person as an interactive table with filters and a detail panel.",
        "Takes the same filters as list_responses; surveyId is required.",
        "Returns a summary of what is on screen, not the answers: to read or analyse them yourself, call list_responses or get_response.",
      ].join(" "),
      inputSchema: ZMcpShowResponsesInput,
      outputSchema: ZMcpShowResponsesOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: buildMcpAppToolMeta("responses"),
    },
    ["responses:read"],
    async (input: TMcpShowResponsesInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3Responses({
        searchParams: buildListResponsesSearchParams({ ...input, includeTotalCount: true }),
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      if (!response.ok) {
        return await responseToMcpToolResult(response, requestId);
      }

      const body = ZMcpResponseListOutput.safeParse(await response.json());
      if (!body.success || !body.data.data || !body.data.meta) {
        return await responseToMcpToolResult(
          problemInternalError(requestId, "The responses came back in a shape this tool cannot show."),
          requestId
        );
      }

      const items = body.data.data;
      const meta = body.data.meta;
      const structuredContent = { ...buildShowResponsesPayload(input, items, meta), requestId };

      return {
        content: [{ type: "text", text: buildShowResponsesText(input, items, meta) }],
        structuredContent,
      };
    }
  );
}
