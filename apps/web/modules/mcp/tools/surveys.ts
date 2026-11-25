import type { McpServer } from "@modelcontextprotocol/server";
import { generateV3Survey } from "@/app/api/v3/surveys/generate/operations";
import {
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  editV3SurveyBlocksResponse,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  setV3SurveyBlockOrderResponse,
  validateV3SurveyFromRawInput,
  withGeneratedInsertIds,
} from "@/app/api/v3/surveys/lib/operations";
import { changeV3SurveyVisibility, getV3SurveyVisibility } from "@/app/api/v3/surveys/visibility/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
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
  type TMcpSetSurveyVisibilityInput,
  type TMcpSurveyVisibilityInput,
  type TMcpValidateSurveyInput,
  ZMcpCreateSurveyInput,
  ZMcpDeleteSurveyInput,
  ZMcpEditSurveyBlocksInput,
  ZMcpGenerateSurveyInput,
  ZMcpGetSurveyInput,
  ZMcpListSurveysInput,
  ZMcpPatchSurveyInput,
  ZMcpSetSurveyBlockOrderInput,
  ZMcpSetSurveyVisibilityInput,
  ZMcpSurveyVisibilityInput,
  ZMcpValidateSurveyInput,
} from "./schemas";
import {
  ZMcpGeneratedSurveyOutput,
  ZMcpSurveyVisibilityChangeOutput,
  ZMcpSurveyVisibilityStateOutput,
} from "./survey-output-schemas";
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
 * The full resource is ~15k tokens on a large survey; returning it from every write would refill the
 * agent's context as fast as the whole-array patch it replaces. `updatedAt` is deliberately kept —
 * it is the `expectedUpdatedAt` for the next call, so edits chain without another read. `warnings`
 * describes the request rather than the resource, so it stays a top-level sibling of `data` exactly
 * as the v3 body carries it, and `visibility` rides along when the resource has it (it is how a caller
 * learns a create landed restricted). REST keeps the full resource (AIP-144); this projection is
 * MCP-only, where context is the scarce resource.
 */
async function conciseSurveyResponse(
  response: Response,
  applied: Record<string, unknown> = {}
): Promise<Response> {
  if (!response.ok) {
    return response;
  }

  try {
    const body = (await response.clone().json()) as {
      data?: Record<string, unknown> & { blocks?: unknown; visibility?: unknown };
      requestId?: string;
      warnings?: unknown;
    };
    const data = body.data ?? {};
    const blocks = data.blocks;

    return Response.json(
      {
        data: {
          id: data.id,
          updatedAt: data.updatedAt,
          blockCount: Array.isArray(blocks) ? blocks.length : undefined,
          ...(data.visibility === undefined ? {} : { visibility: data.visibility }),
          ...applied,
        },
        ...(body.warnings === undefined ? {} : { warnings: body.warnings }),
        requestId: body.requestId,
      },
      { status: response.status, headers: response.headers }
    );
  } catch {
    // This runs inside the write's `run` callback, after the survey exists: a throw here would go
    // through `runMcpMutation`'s catch and mark an already-committed create/update as a failed audit
    // event. The v3 body is always valid JSON, so this is defensive — hand back the unprojected
    // response rather than risk the audit record.
    return response;
  }
}

export function registerSurveyTools(server: McpServer): void {
  registerMcpTool(
    server,
    "list_surveys",
    {
      title: "List surveys",
      description: "List surveys in a Formbricks workspace using the v3 Surveys API contract.",
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
        "Create a Formbricks link survey using the v3 Surveys API contract. Optional `customCss` source is processed by the server; removed constructs come back as top-level `warnings`. Optional create-only `visibility` sets who can read it: omitted, a signed-in creator's survey is restricted when the organization has survey visibility enabled and workspace-visible otherwise, while an API key's is always workspace-visible; `workspace` is readable by everyone with workspace access; `restricted` needs a signed-in user and the feature, else the call is refused with 403 visibility_not_enabled or 422 visibility_change_not_allowed. Declare Embedded Data with typed `embeddedFields` (library fields linked by `key`) or the legacy `variables` / `hiddenFields`. Optional `startLogic` holds rules that run before the first question (screen out to an ending, jump to a block, set a value from URL parameters). Returns a concise acknowledgement by default — `id`, `updatedAt` (the next call's `expectedUpdatedAt`), `blockCount`, `visibility` and any `warnings`; pass response_format: detailed for the full survey resource.",
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
    async (input: TMcpCreateSurveyInput, ctx) => {
      // `response_format` is an MCP projection switch, not part of the v3 survey document; forwarding it
      // would rely on the v3 body parse stripping it.
      const { response_format: responseFormat, ...body } = input;

      return surveyResultForCaller(
        getMcpToolAuthInfo(ctx),
        await runMcpMutation(
          ctx,
          { action: "created", resource: "survey", logContext: { workspaceId: input.workspaceId } },
          async ({ authentication, requestId, auditLog }) => {
            const response = await createV3SurveyResponseFromRawInput({
              body,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            });

            return responseFormat === "detailed" ? response : conciseSurveyResponse(response);
          }
        )
      );
    }
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
        "Returns a concise acknowledgement by default — `id`, `updatedAt` (the next call's `expectedUpdatedAt`), `blockCount`, `visibility` and any `warnings`; pass response_format: detailed for the full survey resource.",
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
    async (input: TMcpPatchSurveyInput, ctx) => {
      const { surveyId, data, response_format: responseFormat, confirm } = input;

      return surveyResultForCaller(
        getMcpToolAuthInfo(ctx),
        await runMcpMutation(
          ctx,
          { action: "updated", resource: "survey", logContext: { surveyId } },
          async ({ authentication, requestId, auditLog }) => {
            // `response_format` is a sibling of `data`, so the v3 patch body is already just the payload.
            const response = await patchV3SurveyResponse({
              surveyId,
              body: data,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
              writeConfirmation: { confirmed: confirm === true },
            });

            return responseFormat === "detailed" ? response : conciseSurveyResponse(response);
          }
        )
      );
    }
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
    "get_survey_visibility",
    {
      title: "Get survey visibility",
      description: [
        "Read a survey's visibility and what changing it would do: the enforced value (restricted or workspace), its owner, whether you may manage it, the outbound connections that would block restricting it now (empty once the survey is settled at restricted with no change in flight), the people and responses a change affects, any change still in flight, and the values a change would act on now.",
        "Call this before set_survey_visibility and show the user the impact and any blockers first.",
        "Visibility changes need the survey visibility feature (Access Control) and are limited to the survey's owner, while they still hold read access to its workspace, or an organization owner/manager. API-key connections cannot read or change visibility. This tool needs Surveys: Read.",
      ].join(" "),
      inputSchema: ZMcpSurveyVisibilityInput,
      outputSchema: ZMcpSurveyVisibilityStateOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "read" }],
    async (input: TMcpSurveyVisibilityInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3SurveyVisibility({
        surveyId: input.surveyId,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerMcpTool(
    server,
    "set_survey_visibility",
    {
      title: "Set survey visibility",
      description: [
        "Change a survey between workspace visibility (everyone in the workspace can see it) and restricted (only its owner and organization owners/managers can see it).",
        "Call get_survey_visibility first and show the user the impact and blockers before restricting. A restriction is refused with a 409 while a webhook, integration, active feedback source, draft or enabled workflow, or non-archived creative uses the survey; archived creatives are unlinked by the restriction. A survey with no owner cannot be restricted (422): ask the user to duplicate it in the Formbricks app to get a restricted copy.",
        "A workspace change the graph has not acknowledged yet answers 503 projection_pending: the change is stored, retry in a few seconds; the survey stays restricted until the graph catches up. Changes are limited to 10 per minute; a 429 asks you to wait before retrying.",
        "Needs the survey visibility feature (Access Control) and the survey's owner, while they still hold read access to its workspace, or an organization owner/manager. API-key connections are refused, and a non-owner workspace writer is refused even with Surveys: Write.",
      ].join(" "),
      inputSchema: ZMcpSetSurveyVisibilityInput,
      outputSchema: ZMcpSurveyVisibilityChangeOutput,
      audit: { action: "visibilityChanged", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        // Can take a survey away from the workspace, and a restriction unlinks archived creatives.
        destructiveHint: true,
        // The same value is a no-op.
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    [{ permission: "surveys", level: "write" }],
    async (input: TMcpSetSurveyVisibilityInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "visibilityChanged", resource: "survey", logContext: { surveyId: input.surveyId } },
        ({ authentication, requestId, auditLog }) =>
          changeV3SurveyVisibility({
            surveyId: input.surveyId,
            body: { visibility: input.visibility },
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerMcpTool(
    server,
    "delete_survey",
    {
      title: "Delete survey",
      description:
        "Delete a Formbricks survey using the v3 Surveys API contract. Refused with a 409 (code survey_has_linked_creatives, listing them in details.creatives) while non-archived creatives open the survey: delete those first (pausing or closing one keeps it linked). A survey that is not a draft and has responses is deleted with them only when you pass confirm: true, after the user agreed; without it the call returns the warning to show them.",
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
    async (input: TMcpDeleteSurveyInput, ctx) =>
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
            writeConfirmation: { confirmed: input.confirm === true },
          })
      )
  );
}
