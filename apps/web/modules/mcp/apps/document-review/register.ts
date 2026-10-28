import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { ZV3DocumentEnvelope } from "@/app/api/v3/documents/lib/envelope";
import { getDocumentAdapter } from "@/app/api/v3/documents/lib/registry";
import { problemInternalError } from "@/app/api/v3/lib/response";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import {
  createMcpInsufficientScopeResponse,
  getMcpAuthentication,
  getMcpRequestId,
  getMcpToolAuthInfo,
  hasMcpScopes,
} from "../../auth";
import { responseToMcpToolResult } from "../../errors";
import { registerScopedTool } from "../../tools/guard-scopes";
import { mcpToolOutput } from "../../tools/output-schemas";
import { registerMcpAppResource } from "../register-app-resource";
import { buildMcpAppToolMeta } from "../tool-meta";
import { classifyDryRun, readPushResult } from "./classify";
import { type TDryRunOutcome, ZDocumentReview, buildDocumentReview, buildReviewText } from "./review";
import { type TMcpReviewDocumentChangeInput, ZMcpReviewDocumentChangeInput } from "./schemas";

// The scopes push_document gates on per kind (tools/documents.ts).
// A review also reads the stored document to diff against, so it needs the kind's read scope as well:
// without it a write-only token could read documents through the diff.
const READ_SCOPE = { survey: "surveys:read", creative: "surveys:read", workflow: "workflows:read" } as const;
const WRITE_SCOPE = {
  survey: "surveys:write",
  creative: "surveys:write",
  workflow: "workflows:write",
} as const;

export function registerDocumentReviewApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "document-review",
    title: "Change review",
    description: "Review what a document change would do, then approve it.",
  });

  registerScopedTool(
    server,
    "review_document_change",
    {
      title: "Review document change",
      description:
        "Show the user what push_document would change and let them approve it in the chat. Takes the same arguments as push_document (kind, id, schemaVersion, expectedUpdatedAt, document). Nothing is ever written by this tool: it compares the stored document with yours and shows the person the changes, what would be removed, and whether the push would be refused. The person approves or cancels in the view; approving runs push_document with these exact arguments, so do not call push_document yourself unless they decline the view and ask you to. Call this instead of push_document whenever the push changes a live or answered survey, a live creative or a workflow, or the user asked to check first.",
      inputSchema: ZMcpReviewDocumentChangeInput,
      outputSchema: mcpToolOutput(ZDocumentReview),
      // A read of a dry run: nothing is changed, and a refused read discloses nothing, so there is no
      // `audit` (the same reason push_document does not record a dry run as an update).
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      _meta: buildMcpAppToolMeta("document-review"),
    },
    { anyOf: ["surveys:write", "workflows:write"] },
    async (input: TMcpReviewDocumentChangeInput, ctx): Promise<CallToolResult> => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const scopes = [WRITE_SCOPE[input.kind], READ_SCOPE[input.kind]];

      if (!hasMcpScopes(authInfo, scopes)) {
        return await responseToMcpToolResult(
          createMcpInsufficientScopeResponse(requestId, scopes),
          requestId
        );
      }

      const adapter = getDocumentAdapter(input.kind);
      const authentication = getMcpAuthentication(authInfo);

      const pulled = await adapter.pull({ id: input.id, authentication, requestId, instance: MCP_API_ROUTE });
      if (!pulled.ok) return await responseToMcpToolResult(pulled, requestId);
      const current = ZV3DocumentEnvelope.safeParse(
        (
          await pulled
            .clone()
            .json()
            .catch(() => undefined)
        )?.data
      );
      if (!current.success) {
        return await responseToMcpToolResult(
          problemInternalError(requestId, "The stored document could not be read."),
          requestId
        );
      }

      // `dryRun: true` is a literal and no `auditLog` is passed: this tool has no way to write.
      const dryRun = (confirmDestructive: boolean) =>
        adapter.push({
          id: input.id,
          document: input.document,
          expectedUpdatedAt: input.expectedUpdatedAt,
          dryRun: true,
          confirmDestructive,
          authentication,
          requestId,
          instance: MCP_API_ROUTE,
        });

      const firstAnswer = await dryRun(false);
      const classified = await classifyDryRun(firstAnswer);
      if (classified.kind === "error") return await responseToMcpToolResult(firstAnswer, requestId);

      let outcome: TDryRunOutcome = classified.outcome;
      if (outcome.type === "destructive") {
        // The refusal names what would go but not the resulting document: ask again with the check
        // lifted, still a dry run, to diff against what the push would store.
        outcome = { ...outcome, result: await readPushResult(await dryRun(true)) };
      }

      const review = buildDocumentReview({
        kind: input.kind,
        id: input.id,
        expectedUpdatedAt: input.expectedUpdatedAt,
        proposed: input.document,
        current: current.data,
        outcome,
      });

      return {
        content: [{ type: "text", text: buildReviewText(review) }],
        structuredContent: { data: review, requestId },
      };
    }
  );
}
