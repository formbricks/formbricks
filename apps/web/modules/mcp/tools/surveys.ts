import type { McpServer } from "@modelcontextprotocol/server";
import { generateV3Survey } from "@/app/api/v3/surveys/generate/operations";
import {
  archiveV3Survey,
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  editV3SurveyBlocksResponse,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  restoreV3Survey,
  setV3SurveyBlockOrderResponse,
  validateV3SurveyFromRawInput,
  withGeneratedInsertIds,
} from "@/app/api/v3/surveys/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { runConfirmedDelete } from "./delete-confirmation";
import { registerMcpTool } from "./guard-permissions";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  type TMcpCreateSurveyInput,
  type TMcpDeleteSurveyInput,
  type TMcpEditSurveyBlocksInput,
  type TMcpGenerateSurveyInput,
  type TMcpGetSurveyInput,
  type TMcpListSurveysInput,
  type TMcpPatchSurveyInput,
  type TMcpSetSurveyBlockOrderInput,
  type TMcpSurveyIdInput,
  type TMcpValidateSurveyInput,
  ZMcpCreateSurveyInput,
  ZMcpDeleteSurveyInput,
  ZMcpEditSurveyBlocksInput,
  ZMcpGenerateSurveyInput,
  ZMcpGetSurveyInput,
  ZMcpListSurveysInput,
  ZMcpPatchSurveyInput,
  ZMcpSetSurveyBlockOrderInput,
  ZMcpSurveyIdInput,
  ZMcpValidateSurveyInput,
} from "./schemas";
import { ZMcpGeneratedSurveyOutput, ZMcpSurveyLifecycleOutput } from "./survey-output-schemas";
import { surveyResultForCaller } from "./survey-targeting";

export function buildListSurveysSearchParams(input: TMcpListSurveysInput): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", input.workspaceId);
  searchParams.set("limit", String(input.limit ?? 20));

  if (input.cursor) {
    searchParams.set("cursor", input.cursor);
  }

  if ((input.includeTotalCount ?? true) === false) {
    searchParams.set("includeTotalCount", "false");
  }

  if (input.sortBy) {
    searchParams.set("sortBy", input.sortBy);
  }

  if (input.filter?.name?.contains) {
    searchParams.set("filter[name][contains]", input.filter.name.contains);
  }

  input.filter?.status?.in?.forEach((status) => {
    searchParams.append("filter[status][in]", status);
  });

  input.filter?.type?.in?.forEach((type) => {
    searchParams.append("filter[type][in]", type);
  });

  return searchParams;
}

/**
 * Project a successful survey-resource response down to what an editing agent actually needs.
 *
 * The full resource is ~15k tokens on a large survey; returning it from every edit would refill the
 * agent's context as fast as the whole-array patch it replaces. `updatedAt` is deliberately kept —
 * it is the `expectedUpdatedAt` for the next call, so edits chain without another read. REST keeps
 * the full resource (AIP-144); this projection is MCP-only, where context is the scarce resource.
 */
async function conciseSurveyResponse(
  response: Response,
  applied: Record<string, unknown>
): Promise<Response> {
  if (!response.ok) {
    return response;
  }

  const body = (await response.clone().json()) as { data?: Record<string, unknown>; requestId?: string };
  const data = body.data ?? {};
  const blocks = data.blocks;

  return Response.json(
    {
      data: {
        id: data.id,
        updatedAt: data.updatedAt,
        blockCount: Array.isArray(blocks) ? blocks.length : undefined,
        ...applied,
      },
      requestId: body.requestId,
    },
    { status: response.status, headers: response.headers }
  );
}

export function registerSurveyTools(server: McpServer): void {
  registerMcpTool(
    server,
    "list_surveys",
    {
      title: "List surveys",
      description:
        "List surveys in a Formbricks workspace using the v3 Surveys API contract. Archived surveys are left out unless `filter.status.in` includes `archived`.",
      inputSchema: ZMcpListSurveysInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "read" }],
    async (input: TMcpListSurveysInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3Surveys({
        searchParams: buildListSurveysSearchParams(input),
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return surveyResultForCaller(authInfo, await responseToMcpToolResult(response, requestId));
    }
  );

  registerMcpTool(
    server,
    "get_survey",
    {
      title: "Get survey",
      description:
        "Get one Formbricks survey using the v3 Surveys API contract, including its custom CSS source (`customCss`). An app survey's `targeting` (segment filters, which name contact attribute values) is left out unless the user's grant gives Segments and Contact attributes: Read.",
      inputSchema: ZMcpGetSurveyInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "read" }],
    async (input: TMcpGetSurveyInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3Survey({
        surveyId: input.surveyId,
        lang: input.lang,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return surveyResultForCaller(authInfo, await responseToMcpToolResult(response, requestId));
    }
  );

  registerMcpTool(
    server,
    "create_survey",
    {
      title: "Create survey",
      description:
        "Create a Formbricks link survey using the v3 Surveys API contract. Optional `customCss` source is processed by the server; removed constructs come back as top-level `warnings`. Declare Embedded Data with typed `embeddedFields` (library fields linked by `key`) or the legacy `variables` / `hiddenFields`. Optional `startLogic` holds rules that run before the first question (screen out to an ending, jump to a block, set a value from URL parameters).",
      inputSchema: ZMcpCreateSurveyInput,
      audit: { action: "created", targetType: "survey" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpCreateSurveyInput, ctx) =>
      surveyResultForCaller(
        getMcpToolAuthInfo(ctx),
        await runMcpMutation(
          ctx,
          { action: "created", resource: "survey", logContext: { workspaceId: input.workspaceId } },
          ({ authentication, requestId, auditLog }) =>
            createV3SurveyResponseFromRawInput({
              body: input,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            })
        )
      )
  );

  // Persists nothing, but declares Surveys: Write like the REST route (`readWrite` on the workspace):
  // each call runs a model on the organization's AI budget, which a read-only connection must not spend.
  // The operation charges the same 10/min budget the route does and checks the AI toggle and entitlement.
  registerMcpTool(
    server,
    "generate_survey",
    {
      title: "Generate survey draft",
      description: [
        "Draft a survey from a plain-language prompt with the workspace organization's AI. Saves nothing:",
        "review the returned `payload`, then pass it to create_survey to save it. `validation` says whether",
        "create_survey would accept it as is. Limited to 10 calls a minute; needs AI enabled for the organization.",
      ].join(" "),
      inputSchema: ZMcpGenerateSurveyInput,
      outputSchema: ZMcpGeneratedSurveyOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpGenerateSurveyInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await generateV3Survey({
        body: input,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerMcpTool(
    server,
    "validate_survey",
    {
      title: "Validate survey",
      description:
        "Validate a v3 survey create or patch payload, or custom CSS alone (operation customCss: compiled result and warnings), without writing anything.",
      inputSchema: ZMcpValidateSurveyInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "read" }],
    async (input: TMcpValidateSurveyInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      // validate_survey never persists changes (readOnlyHint) — a dry-run validation of a create or
      // patch payload only needs read access, and validateV3Survey gates at "read" to match. The
      // actual write permission is enforced when create_survey / patch_survey run.
      const response = await validateV3SurveyFromRawInput({
        body: input,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerMcpTool(
    server,
    "patch_survey",
    {
      title: "Patch survey",
      description: [
        "Update survey-level fields — name, status, languages, showLanguageSwitch, autoSelectLanguage, endings, welcomeCard, embeddedFields (typed Embedded Data; the legacy variables and hiddenFields are derived from it), startLogic (rules before the first question), customCss — using the v3 Surveys API patch contract.",
        "On a survey that is not a draft and already has responses, nothing changes until you pass confirm: true: the call returns the editor's caution text instead, so show it to the user and retry only after they agree.",
        "For block changes prefer edit_survey_blocks (update, insert, remove) or set_survey_block_order (reorder): they address blocks by id, cost a fraction of the tokens, and cannot drop a block by omission.",
        "Provided top-level arrays and objects replace that whole subtree, so a partial `blocks` array deletes every block it leaves out.",
        "The full get_survey output can be sent back unchanged; `updatedAt` is then an optimistic-concurrency precondition and a mismatch returns 409.",
        "App surveys: `distribution.showConditions` limits when a triggered survey shows (page URL lists, referrer, query parameter, pages viewed, time on site, visited URLs, device, browser, window width); `distribution` replaces as a whole, so send the full object from get_survey.",
      ].join(" "),
      inputSchema: ZMcpPatchSurveyInput,
      audit: { action: "updated", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpPatchSurveyInput, ctx) =>
      surveyResultForCaller(
        getMcpToolAuthInfo(ctx),
        await runMcpMutation(
          ctx,
          { action: "updated", resource: "survey", logContext: { surveyId: input.surveyId } },
          ({ authentication, requestId, auditLog }) =>
            patchV3SurveyResponse({
              surveyId: input.surveyId,
              body: input.data,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
              writeConfirmation: { confirmed: input.confirm === true },
            })
        )
      )
  );

  registerMcpTool(
    server,
    "edit_survey_blocks",
    {
      title: "Edit survey blocks",
      description: [
        "Preferred tool for changing a survey's questions: update, insert or remove whole blocks by id without resending the others.",
        "Use it for any wording, add or delete change — patch_survey would resend every block to alter one.",
        "Operations apply in order and atomically — either all of them land or none do.",
        "Call get_survey first and pass its `updatedAt` as `expectedUpdatedAt`; on a 409 re-read and retry.",
        "An `update` replaces the whole block, so build it from a fresh read — anything you omit is dropped, and block content must carry every configured language.",
        "An inserted block gets an id automatically; supply your own only if a later op in the same request needs to anchor after it.",
        "Removing a block orphans any answers already collected for it, and the API cannot undo that — on a survey that is not a draft, confirm with the user before removing.",
        "On a survey that is not a draft and already has responses, nothing changes until you pass confirm: true: the call returns the editor's caution text instead, so show it to the user and retry only after they agree.",
      ].join(" "),
      inputSchema: ZMcpEditSurveyBlocksInput,
      audit: { action: "updated", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpEditSurveyBlocksInput, ctx) =>
      surveyResultForCaller(
        getMcpToolAuthInfo(ctx),
        await runMcpMutation(
          ctx,
          { action: "updated", resource: "survey", logContext: { surveyId: input.surveyId } },
          async ({ authentication, requestId, auditLog }) => {
            const { surveyId, response_format: responseFormat, confirm, ...body } = input;
            // Mint insert ids here rather than letting the operation do it alone, so `applied` can
            // report the id of a block the caller did not name — otherwise an agent inserts a block
            // and has no way to reference it without re-reading the survey. The helper is idempotent,
            // so the operation running it again is a no-op.
            const ops = withGeneratedInsertIds(body.ops);
            const response = await editV3SurveyBlocksResponse({
              surveyId,
              body: { ...body, ops },
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
              writeConfirmation: { confirmed: confirm === true },
            });

            return responseFormat === "detailed"
              ? response
              : conciseSurveyResponse(response, {
                  applied: ops.map((op) => ({ op: op.op, id: op.op === "insert" ? op.block.id : op.id })),
                });
          }
        )
      )
  );

  registerMcpTool(
    server,
    "set_survey_block_order",
    {
      title: "Set survey block order",
      description: [
        "Preferred tool for reordering a survey's questions — moving, swapping or promoting a block to first or last.",
        "List every block id exactly once, in the order you want.",
        "Cheaper and safer than resending the blocks through patch_survey: a missing or duplicated id is rejected, which catches a dropped block.",
        "Call get_survey first and pass its `updatedAt` as `expectedUpdatedAt`; on a 409 re-read and retry.",
        "To repeat a call safely, refresh `expectedUpdatedAt` from the previous response or omit it — reusing the old value is a stale precondition and returns 409, which is the precondition working, not the reorder failing.",
        "On a survey that is not a draft and already has responses, nothing changes until you pass confirm: true: the call returns the editor's caution text instead, so show it to the user and retry only after they agree.",
      ].join(" "),
      inputSchema: ZMcpSetSurveyBlockOrderInput,
      audit: { action: "updated", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        // Unlike patch_survey, the same `order` always yields the same survey, and an order that
        // already matches performs no write at all — so a repeat does not even move `updatedAt`.
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpSetSurveyBlockOrderInput, ctx) =>
      surveyResultForCaller(
        getMcpToolAuthInfo(ctx),
        await runMcpMutation(
          ctx,
          { action: "updated", resource: "survey", logContext: { surveyId: input.surveyId } },
          async ({ authentication, requestId, auditLog }) => {
            const { surveyId, response_format: responseFormat, confirm, ...body } = input;
            const response = await setV3SurveyBlockOrderResponse({
              surveyId,
              body,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
              writeConfirmation: { confirmed: confirm === true },
            });

            return responseFormat === "detailed"
              ? response
              : conciseSurveyResponse(response, { order: body.order });
          }
        )
      )
  );

  registerMcpTool(
    server,
    "delete_survey",
    {
      title: "Delete survey (deprecated)",
      description:
        "Deprecated: removed in Formbricks 7.0. Use archive_survey instead, which is reversible. Delete a Formbricks survey and all of its responses using the v3 Surveys API contract. The user is asked to confirm first; it cannot be undone. Refused with a 409 (code survey_has_linked_creatives, listing them in details.creatives) while non-archived creatives open the survey: delete those first (pausing or closing one keeps it linked).",
      inputSchema: ZMcpDeleteSurveyInput,
      audit: { action: "deleted", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    // Finding 07: deleting a survey removes its responses for good, so the user confirms first and the
    // model's own `confirm` counts only where the client cannot ask (see `runConfirmedDelete`).
    async (input: TMcpDeleteSurveyInput, ctx) =>
      runConfirmedDelete({
        tool: "delete_survey",
        resourceKey: input.surveyId,
        prompt: `Permanently delete survey ${input.surveyId} and all of its responses? This cannot be undone.`,
        confirm: input.confirm,
        ctx,
        run: () =>
          runMcpMutation(
            ctx,
            { action: "deleted", resource: "survey", logContext: { surveyId: input.surveyId } },
            ({ authentication, requestId, auditLog }) =>
              deleteV3Survey({
                surveyId: input.surveyId,
                authentication,
                requestId,
                instance: MCP_API_ROUTE,
                auditLog,
                // Reached only after the user agreed, through the prompt or a client that cannot ask.
                writeConfirmation: { confirmed: true },
              })
          ),
      })
  );

  registerMcpTool(
    server,
    "archive_survey",
    {
      title: "Archive survey",
      description:
        'Archive a survey: it leaves the default list, stops collecting responses (an in-progress survey is paused) and becomes read-only until restored. Ask the user before archiving a survey that is not a draft and already has responses. Formbricks permanently deletes an archived survey and its responses at least 30 days after it was archived, unless a data-retention exemption holds it longer. Find it again with list_surveys and filter.status.in: ["archived"], then use restore_survey. Works on any survey, including legacy question-based ones, and archiving an already-archived survey changes nothing. Prefer this over the deprecated delete_survey.',
      inputSchema: ZMcpSurveyIdInput,
      outputSchema: ZMcpSurveyLifecycleOutput,
      audit: { action: "archived", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        // Takes the survey out of the default list and stops collection; reversible for 30 days.
        destructiveHint: true,
        // Archiving an archived survey is a no-op, and the purge clock is not restarted.
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpSurveyIdInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "archived", resource: "survey", logContext: { surveyId: input.surveyId } },
        ({ authentication, requestId, auditLog }) =>
          archiveV3Survey({
            surveyId: input.surveyId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerMcpTool(
    server,
    "restore_survey",
    {
      title: "Restore survey",
      description:
        "Restore an archived survey: it is listed and editable again, and keeps its status from before the restore, so a survey archived while in progress comes back paused. If a data-retention policy archived it, restoring gives it a fresh retention period. Restoring a survey that is not archived changes nothing. Idempotent.",
      inputSchema: ZMcpSurveyIdInput,
      outputSchema: ZMcpSurveyLifecycleOutput,
      audit: { action: "restored", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpSurveyIdInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "restored", resource: "survey", logContext: { surveyId: input.surveyId } },
        ({ authentication, requestId, auditLog }) =>
          restoreV3Survey({
            surveyId: input.surveyId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}
