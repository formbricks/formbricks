import {
  type CallToolResult,
  type InputRequiredResult,
  type McpServer,
  acceptedContent,
  inputRequired,
  inputResponse,
} from "@modelcontextprotocol/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  batchDeleteV3Responses,
  countV3ResponsesOperation,
  createV3ResponseFromRawInput,
  deleteV3Response,
  getV3Response,
  listV3Responses,
  updateV3ResponseFromRawInput,
} from "@/app/api/v3/responses/lib/operations";
import { validateV3ResponseFromRawInput } from "@/app/api/v3/responses/lib/validate-operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { type TMcpConfirmationState, mcpRequestStateCodec } from "../request-state";
import { registerScopedTool } from "./guard-scopes";
import {
  type TMcpBatchDeleteResponsesInput,
  type TMcpCountResponsesInput,
  type TMcpCreateResponseInput,
  type TMcpDeleteResponseInput,
  type TMcpGetResponseInput,
  type TMcpListResponsesInput,
  type TMcpUpdateResponseInput,
  type TMcpValidateResponseInput,
  ZMcpBatchDeleteResponsesInput,
  ZMcpCountResponsesInput,
  ZMcpCreateResponseInput,
  ZMcpDeleteResponseInput,
  ZMcpGetResponseInput,
  ZMcpListResponsesInput,
  ZMcpResponseBatchDeleteOutput,
  ZMcpResponseCountOutput,
  ZMcpResponseDeleteOutput,
  ZMcpResponseListOutput,
  ZMcpResponseOutput,
  ZMcpResponseValidationOutput,
  ZMcpUpdateResponseInput,
  ZMcpValidateResponseInput,
} from "./response-schemas";
import { runMcpMutation } from "./run-mcp-mutation";

/**
 * MCP tools over the v3 Responses API — one per documented operation, and no more.
 *
 * **The tool set mirrors the API deliberately.** Every tool here is one v3 operation, so what an
 * agent can do through MCP is exactly what an API key can do over HTTP, and the answer to "can the
 * agent do X" is read off one list rather than two. A convenience tool with no operation behind it
 * (an `add one tag` that reads, merges and patches, say) would be a second surface with its own
 * semantics to document, test and keep in step — and `update_response` already does that job.
 *
 * Every tool goes through `registerScopedTool`, so the `responses:read` / `responses:write` gate is
 * structural rather than something a handler can forget, and every tool calls the operation rather
 * than the database — the operation owns tenancy, so a foreign id answers the same 403 here as it
 * does over HTTP. The MCP scope and the workspace permission are separate gates: `responses:write`
 * lets a caller reach the delete tools at all, and the operation still requires `manage` on the
 * workspace to carry them out.
 *
 * **The scopes are grantable but not advertised yet.** `MCP_RESOURCE_SCOPES` deliberately omits them
 * until the integrator notice goes out — advertising a scope to clients that registered before it
 * existed earns them `invalid_scope` on their next consent. Registering tools advertises nothing, so
 * this ships safely ahead of that notice; adding the pair to that list is the last step of the
 * rollout.
 */

/**
 * Why a response tool and a feedback-record tool are not the same thing.
 *
 * The Hub's standalone MCP server was folded into this one, so ten feedback-record tools sit beside
 * these and `list_feedback_records(source_id=<surveyId>)` looks like it answers the same question.
 * It does not, and a model that picks the wrong one undercounts silently.
 *
 * The full paragraph goes on the two tools where the wrong pick is both likely and quiet — listing
 * and counting. Every other tool carries the one-line form: a description is context every client
 * pays for on every `tools/list`, and eight copies of this would cost more than it teaches.
 */
const FEEDBACK_RECORD_BOUNDARY = [
  "A response is the submission-shaped record: one row per respondent, every answer as submitted,",
  "writable and deletable. A feedback record is the per-element analytical projection — one row per",
  "mapped element, canonicalized to the default-language label, enriched with sentiment and",
  "embeddings — and it exists only for surveys with an active mapping, only for mapped elements, and",
  "only once a response is finished. Feedback records are never a complete view of a survey's",
  "responses, so counting them to answer 'how many responses' undercounts. Use these tools for the",
  "submissions themselves and the feedback-record tools for analysis of what was said.",
].join(" ");

const FEEDBACK_RECORD_BOUNDARY_SHORT =
  "Operates on submission-shaped responses, not on the feedback records the analysis tools read.";

/** Read tools: no side effects, safe to repeat, reaching data this server does not itself own. */
const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const toSearchParams = (entries: Record<string, string | string[] | undefined>): URLSearchParams => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
      continue;
    }

    searchParams.set(key, value);
  }

  return searchParams;
};

/**
 * The filters both list-shaped tools share, in the bracket spelling the query parser reads.
 *
 * Built once so `count_responses` cannot drift from the listing it is supposed to be counting — the
 * same reason the query parser itself is shared between the two routes.
 */
const sharedFilterParams = (
  input: TMcpListResponsesInput | TMcpCountResponsesInput
): Record<string, string | string[] | undefined> => ({
  workspaceId: input.workspaceId,
  surveyId: input.surveyId,
  contactId: input.contactId,
  "filter[createdAt][gte]": input.createdAtGte,
  "filter[createdAt][lte]": input.createdAtLte,
  "filter[finished][eq]": input.finished === undefined ? undefined : String(input.finished),
  "filter[language][in]": input.language,
});

export const buildListResponsesSearchParams = (input: TMcpListResponsesInput): URLSearchParams =>
  toSearchParams({
    ...sharedFilterParams(input),
    limit: String(input.limit),
    cursor: input.cursor,
    includeTotalCount: input.includeTotalCount ? "true" : undefined,
    sortBy: input.sortBy,
  });

export const buildCountResponsesSearchParams = (input: TMcpCountResponsesInput): URLSearchParams =>
  toSearchParams({ ...sharedFilterParams(input), precision: input.precision });

/** The context every tool derives the same way, so no tool invents its own request id. */
const toolContext = (ctx: TMcpToolContext) => {
  const authInfo = getMcpToolAuthInfo(ctx);
  const requestId = getMcpRequestId(authInfo);

  return { authentication: getMcpAuthentication(authInfo), requestId, instance: MCP_API_ROUTE };
};

export function registerResponseTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_responses",
    {
      title: "List responses",
      description: [
        "List survey responses in a Formbricks workspace, newest first.",
        "Scope is always a workspace; narrow with surveyId or contactId.",
        FEEDBACK_RECORD_BOUNDARY,
      ].join(" "),
      inputSchema: ZMcpListResponsesInput,
      outputSchema: ZMcpResponseListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["responses:read"],
    async (input: TMcpListResponsesInput, ctx) => {
      const context = toolContext(ctx);
      const response = await listV3Responses({
        searchParams: buildListResponsesSearchParams(input),
        ...context,
      });

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "count_responses",
    {
      title: "Count responses",
      description: [
        "Count the survey responses matching a filter, without fetching them.",
        "Prefer this over listing a page and counting it.",
        FEEDBACK_RECORD_BOUNDARY,
      ].join(" "),
      inputSchema: ZMcpCountResponsesInput,
      outputSchema: ZMcpResponseCountOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["responses:read"],
    async (input: TMcpCountResponsesInput, ctx) => {
      const context = toolContext(ctx);
      const response = await countV3ResponsesOperation({
        searchParams: buildCountResponsesSearchParams(input),
        ...context,
      });

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "get_response",
    {
      title: "Get response",
      description: [
        "Read one survey response in full, with every answer labelled by the element that asked it.",
        FEEDBACK_RECORD_BOUNDARY_SHORT,
      ].join(" "),
      inputSchema: ZMcpGetResponseInput,
      outputSchema: ZMcpResponseOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["responses:read"],
    async (input: TMcpGetResponseInput, ctx) => {
      const context = toolContext(ctx);
      const response = await getV3Response({ responseId: input.responseId, ...context });

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "validate_response",
    {
      title: "Validate a response payload",
      description: [
        "Check a create or patch payload and see what the write would do, without writing anything.",
        "Reports the language that would be stamped, the references that would be linked, the quotas",
        "that would count, and whether the response pipeline would fire.",
        "Use it before create_response or update_response on anything you cannot easily undo.",
        FEEDBACK_RECORD_BOUNDARY_SHORT,
      ].join(" "),
      inputSchema: ZMcpValidateResponseInput,
      outputSchema: ZMcpResponseValidationOutput,
      annotations: READ_ANNOTATIONS,
    },
    // `responses:write`, though the tool writes nothing. The dry run resolves the same references the
    // write does and reports what it would do, so gating it at `read` would make it a cheaper probe
    // than the operation it describes. `validate_survey` gates at read because that one is a pure
    // function of its input; this one is not.
    ["responses:write"],
    async (input: TMcpValidateResponseInput, ctx) => {
      const context = toolContext(ctx);
      const response = await validateV3ResponseFromRawInput({ body: input, ...context });

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "create_response",
    {
      title: "Create response",
      description: [
        "Record a survey response. This is a real submission: it fires webhooks, integrations and",
        "follow-ups, counts against quotas, and is metered like any other response.",
        "Call validate_response first to see exactly what it would do.",
        FEEDBACK_RECORD_BOUNDARY_SHORT,
      ].join(" "),
      inputSchema: ZMcpCreateResponseInput,
      outputSchema: ZMcpResponseOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["responses:write"],
    async (input: TMcpCreateResponseInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "response" },
        ({ authentication, requestId, auditLog }) =>
          createV3ResponseFromRawInput({
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
    "update_response",
    {
      title: "Update response",
      description: [
        "Correct a survey response. A provided `data` or `tags` replaces that whole value rather than",
        "merging into it, so send the complete set — to add one tag, read the response first and send",
        "every tag it should end up with. Finishing a response fires the response pipeline.",
        FEEDBACK_RECORD_BOUNDARY_SHORT,
      ].join(" "),
      inputSchema: ZMcpUpdateResponseInput,
      outputSchema: ZMcpResponseOutput,
      annotations: {
        readOnlyHint: false,
        // A wholesale replace removes the answers and tags it omits, and the previous value is not
        // recoverable from the result — which is what this annotation is for.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["responses:write"],
    async (input: TMcpUpdateResponseInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "response", logContext: { responseId: input.responseId } },
        ({ authentication, requestId, auditLog }) =>
          updateV3ResponseFromRawInput({
            responseId: input.responseId,
            body: input.data,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerDeleteTools(server);
}

/**
 * What a batch confirmation is about, as a fixed-width digest.
 *
 * The ids themselves would work and would be more legible, but a hundred cuid2s is ~2.5 KB of sealed
 * state that then rides through the client on every retry. A digest binds the same thing — this
 * workspace, these ids, in this order — at 64 characters. Order is deliberately significant: it costs
 * nothing, and a caller that reorders its list gets asked again rather than silently reusing an
 * answer about a set it has since edited.
 */
export const batchResourceKey = (workspaceId: string, ids: readonly string[]): string =>
  createHash("sha256")
    .update(`${workspaceId}\u0000${ids.join("\u0000")}`)
    .digest("hex");

/** The key the confirmation elicitation is filed under, on both the request and the retry. */
const CONFIRM_KEY = "confirm";

const ZConfirmationAnswer = z.object({ confirm: z.boolean() });

type TDeleteDecision = { kind: "confirmed" } | { kind: "ask" } | { kind: "refused"; reason: string };

/**
 * A refusal shaped like the error half of the output schema, so a client reading
 * `structuredContent` against the advertised schema sees the same shape it sees for a 403.
 *
 * **`isError` is set, although nothing malfunctioned.** The first version left it off, reasoning that
 * a declined confirmation is the tool working correctly. That is true and beside the point: a model
 * that reads only `isError` would take the absence as success and tell the user their response was
 * deleted when it was not. Of the two ways to be wrong — a model that retries, or a model that
 * reports a deletion that never happened — only one of them misleads a person about their data.
 */
const refusal = (reason: string, requestId: string): CallToolResult => {
  const payload = { error: { status: 428, title: "Confirmation required", detail: reason, requestId } };

  return {
    isError: true,
    structuredContent: payload,
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
};

/**
 * Whether this round already carries the user's agreement, and whether that agreement is about the
 * resources actually named in the arguments.
 *
 * **The resource check is the reason the state is sealed at all.** `requestState` and the tool
 * arguments both come back through the client, so without comparing them a client could be asked
 * about response A and retry the confirmation against response B. The HMAC proves this server minted
 * the state for this caller; the comparison proves it is about this delete.
 */
function decideDelete(
  tool: string,
  resourceKey: string,
  confirm: boolean | undefined,
  ctx: TMcpToolContext
): TDeleteDecision {
  if (confirm === true) {
    return { kind: "confirmed" };
  }

  const answer = inputResponse(ctx.mcpReq?.inputResponses, CONFIRM_KEY);

  if (answer.kind === "missing") {
    return { kind: "ask" };
  }

  if (answer.kind !== "elicit" || answer.action !== "accept") {
    return { kind: "refused", reason: "Deletion was not confirmed, so nothing was deleted." };
  }

  const content = acceptedContent(ctx.mcpReq?.inputResponses, CONFIRM_KEY, ZConfirmationAnswer);

  if (content?.confirm !== true) {
    return { kind: "refused", reason: "Deletion was declined, so nothing was deleted." };
  }

  const state = ctx.mcpReq?.requestState<TMcpConfirmationState>();

  if (!state || typeof state !== "object" || state.tool !== tool || state.resourceId !== resourceKey) {
    return {
      kind: "refused",
      reason: "The confirmation did not match this request, so nothing was deleted.",
    };
  }

  return { kind: "confirmed" };
}

/**
 * Ask, and hand the client everything it needs to come back.
 *
 * On a client that cannot elicit this result is never reached usefully — which is why both delete
 * tools take `confirm` as an argument. That is not a fallback bolted on afterwards: it is the path a
 * 2025-era client and a headless caller use, and it is the reason the tools work at all without
 * elicitation support.
 */
async function askToConfirm(
  tool: string,
  resourceKey: string,
  message: string,
  ctx: TMcpToolContext
): Promise<InputRequiredResult> {
  return inputRequired({
    inputRequests: {
      [CONFIRM_KEY]: inputRequired.elicit({
        message,
        requestedSchema: ZConfirmationAnswer,
      }),
    },
    requestState: await mcpRequestStateCodec.mint({ tool, resourceId: resourceKey }, ctx),
  });
}

/**
 * `delete_response` and `batch_delete_responses`, which ask before they delete.
 *
 * A response is someone's submitted answers and there is no undo, so these confirm rather than
 * trusting that the model read the request correctly. `idempotentHint` is true on both: a response
 * that is already gone answers the same 403 as one that was never this caller's, so repeating a call
 * converges rather than compounding.
 */
function registerDeleteTools(server: McpServer): void {
  registerScopedTool(
    server,
    "delete_response",
    {
      title: "Delete response",
      description: [
        "Permanently delete one survey response and its uploaded files. This cannot be undone.",
        "Asks for confirmation first; pass confirm: true when the user has already agreed, or when",
        "your client cannot answer prompts.",
        FEEDBACK_RECORD_BOUNDARY_SHORT,
      ].join(" "),
      inputSchema: ZMcpDeleteResponseInput,
      outputSchema: ZMcpResponseDeleteOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["responses:write"],
    async (input: TMcpDeleteResponseInput, ctx) => {
      const decision = decideDelete("delete_response", input.responseId, input.confirm, ctx);

      if (decision.kind === "ask") {
        return await askToConfirm(
          "delete_response",
          input.responseId,
          `Permanently delete response ${input.responseId}? This cannot be undone.`,
          ctx
        );
      }

      if (decision.kind === "refused") {
        return refusal(decision.reason, toolContext(ctx).requestId);
      }

      return runMcpMutation(
        ctx,
        { action: "deleted", resource: "response", logContext: { responseId: input.responseId } },
        ({ authentication, requestId, auditLog }) =>
          deleteV3Response({
            responseId: input.responseId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      );
    }
  );

  registerScopedTool(
    server,
    "batch_delete_responses",
    {
      title: "Delete responses in bulk",
      description: [
        "Permanently delete up to 100 survey responses in one transaction. This cannot be undone.",
        "Use this rather than calling delete_response in a loop.",
        "Asks for confirmation first; pass confirm: true when the user has already agreed, or when",
        "your client cannot answer prompts.",
        FEEDBACK_RECORD_BOUNDARY_SHORT,
      ].join(" "),
      inputSchema: ZMcpBatchDeleteResponsesInput,
      outputSchema: ZMcpResponseBatchDeleteOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["responses:write"],
    async (input: TMcpBatchDeleteResponsesInput, ctx) => {
      const resourceKey = batchResourceKey(input.workspaceId, input.ids);
      const decision = decideDelete("batch_delete_responses", resourceKey, input.confirm, ctx);

      if (decision.kind === "ask") {
        return await askToConfirm(
          "batch_delete_responses",
          resourceKey,
          `Permanently delete ${input.ids.length} response(s)? This cannot be undone.`,
          ctx
        );
      }

      if (decision.kind === "refused") {
        return refusal(decision.reason, toolContext(ctx).requestId);
      }

      return runMcpMutation(
        ctx,
        {
          action: "deleted",
          resource: "response",
          logContext: { workspaceId: input.workspaceId, count: input.ids.length },
        },
        ({ authentication, requestId, auditLog }) =>
          batchDeleteV3Responses({
            workspaceId: input.workspaceId,
            ids: input.ids,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      );
    }
  );
}
