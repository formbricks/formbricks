import type { McpServer } from "@modelcontextprotocol/server";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { listV3ActionClasses } from "@/app/api/v3/action-classes/lib/operations";
import { listV3ContactAttributeKeys } from "@/app/api/v3/contact-attribute-keys/lib/operations";
import { problemTooManyRequests } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { generateV3Survey } from "@/app/api/v3/surveys/generate/operations";
import { archiveV3Survey, restoreV3Survey } from "@/app/api/v3/surveys/lib/operations";
import { changeV3SurveyVisibility, getV3SurveyVisibility } from "@/app/api/v3/surveys/visibility/operations";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import {
  ZMcpActionClassListOutput,
  ZMcpContactAttributeKeyListOutput,
  ZMcpSurveyLifecycleOutput,
} from "./lifecycle-output-schemas";
import {
  type TMcpArchiveSurveyInput,
  type TMcpGenerateSurveyInput,
  type TMcpGetSurveyVisibilityInput,
  type TMcpListActionClassesInput,
  type TMcpListContactAttributeKeysInput,
  type TMcpRestoreSurveyInput,
  type TMcpSetSurveyVisibilityInput,
  ZMcpArchiveSurveyInput,
  ZMcpGenerateSurveyInput,
  ZMcpGetSurveyVisibilityInput,
  ZMcpListActionClassesInput,
  ZMcpListContactAttributeKeysInput,
  ZMcpRestoreSurveyInput,
  ZMcpSetSurveyVisibilityInput,
} from "./lifecycle-schemas";
import { runMcpMutation } from "./run-mcp-mutation";

/**
 * Survey lifecycle and reference tools over the v3 surveys, action-class and attribute-key operations:
 * archive, restore, visibility, AI draft generation, and the two lists an app survey's triggers and
 * targeting filters refer to. Every tool is a thin adapter; the scope is the first gate and the operation
 * still resolves the workspace and checks access. All of them ride on the survey scopes (agent-first scope
 * model, ADR 0015): reads on `surveys:read`, writes on `surveys:write`.
 */

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/**
 * The per-actor limit a route applies in its wrapper, which an MCP call never goes through. Keyed by the
 * same identifier as the route's, so one actor shares one budget across both surfaces. The generic
 * `api:v3` budget is already applied when the MCP request authenticates.
 */
function getRateLimitIdentifier(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }

  return authentication && "apiKeyId" in authentication ? authentication.apiKeyId : null;
}

async function applyToolRateLimit(
  config: TRateLimitConfig,
  authentication: TV3Authentication,
  requestId: string
): Promise<Response | null> {
  const identifier = getRateLimitIdentifier(authentication);
  if (!identifier) {
    return null;
  }

  try {
    await applyRateLimit(config, identifier);
    return null;
  } catch (error) {
    logger
      .withContext({ requestId })
      .warn({ statusCode: 429, namespace: config.namespace }, "MCP tool rate limit exceeded");
    return problemTooManyRequests(
      requestId,
      error instanceof Error ? error.message : "Rate limit exceeded",
      error instanceof TooManyRequestsError ? error.retryAfter : undefined
    );
  }
}

export function registerLifecycleTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_action_classes",
    {
      title: "List action classes",
      description:
        "List a workspace's action classes (the named events an app survey can be triggered by). Use the `id` as `distribution.triggers[].actionClassId` when creating or patching an app survey.",
      inputSchema: ZMcpListActionClassesInput,
      outputSchema: ZMcpActionClassListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["surveys:read"],
    async (input: TMcpListActionClassesInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3ActionClasses({
        workspaceId: input.workspaceId,
        limit: input.limit,
        cursor: input.cursor,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "list_contact_attribute_keys",
    {
      title: "List contact attribute keys",
      description:
        "List a workspace's contact attribute keys. Use the `key` as `targeting.filters[].root.contactAttributeKey` when targeting an app survey; `dataType` (string, number, date) hints which operators apply.",
      inputSchema: ZMcpListContactAttributeKeysInput,
      outputSchema: ZMcpContactAttributeKeyListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["surveys:read"],
    async (input: TMcpListContactAttributeKeysInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3ContactAttributeKeys({
        workspaceId: input.workspaceId,
        limit: input.limit,
        cursor: input.cursor,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "archive_survey",
    {
      title: "Archive survey",
      description:
        "Archive a survey: it leaves the default list, stops collecting responses (an In progress survey becomes Paused) and is permanently deleted by the retention job once its retention period ends. restore_survey undoes it before then, but a survey that was In progress comes back Paused. Archiving an archived survey changes nothing.",
      inputSchema: ZMcpArchiveSurveyInput,
      outputSchema: ZMcpSurveyLifecycleOutput,
      audit: { action: "archived", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpArchiveSurveyInput, ctx) =>
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

  registerScopedTool(
    server,
    "restore_survey",
    {
      title: "Restore survey",
      description:
        "Restore an archived survey to the list with the status it had; it is not republished, so publish it with patch_survey (status) if it should collect again. A survey archived by the retention policy gets a full retention period again. Restoring a survey that is not archived changes nothing.",
      inputSchema: ZMcpRestoreSurveyInput,
      outputSchema: ZMcpSurveyLifecycleOutput,
      audit: { action: "restored", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpRestoreSurveyInput, ctx) =>
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

  registerScopedTool(
    server,
    "get_survey_visibility",
    {
      title: "Get survey visibility",
      description:
        "Read who can see a survey (`workspace` or `restricted`), its owner, any change still pending, what a change would affect (`impact`), the connections that currently refuse `restricted` (`blockers`) and the values set_survey_visibility would act on (`allowedTargets`). Needs an OAuth sign-in as the survey's owner or an organization owner or manager, with the visibility feature enabled: everyone else, and every API key, gets the same 403 as for an unknown survey.",
      inputSchema: ZMcpGetSurveyVisibilityInput,
      annotations: READ_ANNOTATIONS,
    },
    ["surveys:read"],
    async (input: TMcpGetSurveyVisibilityInput, ctx) => {
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

  registerScopedTool(
    server,
    "set_survey_visibility",
    {
      title: "Set survey visibility",
      description:
        "Set a survey to `restricted` (owner and organization owners and managers only) or `workspace` (everyone with access to the workspace). Restricting takes effect at once and answers 409 while webhooks, integrations, active feedback sources, workflows or non-archived creatives depend on the survey (list them with get_survey_visibility); sharing with the workspace may answer 503 `projection_pending`: the change is stored and the survey stays restricted until it takes effect a few seconds later (check get_survey_visibility). Limited to 10 calls a minute. Same access rules as get_survey_visibility: an OAuth sign-in, never an API key.",
      inputSchema: ZMcpSetSurveyVisibilityInput,
      audit: { action: "visibilityChanged", targetType: "survey", targetIdArg: "surveyId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        // Asking for the visibility it already has writes nothing.
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpSetSurveyVisibilityInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "visibilityChanged", resource: "survey", logContext: { surveyId: input.surveyId } },
        async ({ authentication, requestId, auditLog }) =>
          (await applyToolRateLimit(rateLimitConfigs.api.v3SurveyVisibility, authentication, requestId)) ??
          (await changeV3SurveyVisibility({
            surveyId: input.surveyId,
            body: { visibility: input.visibility },
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          }))
      )
  );

  registerScopedTool(
    server,
    "generate_survey",
    {
      title: "Generate survey draft",
      description: [
        "Draft a survey from a prompt with the organization's AI provider. Nothing is saved: the answer's `payload` is a ready create_survey input (status draft), which you can review, edit, then pass to create_survey.",
        "It spends AI quota: it needs an organization with AI smart tools enabled on an instance with an AI provider configured, answers 403 or 503 when it does not, and 429 when the provider or Formbricks quota is used up. Limited to 10 calls a minute.",
        "A prompt with no clear goal, audience or topic is refused with a 400; a draft the AI got wrong is a 422, so retry or add detail.",
      ].join(" "),
      inputSchema: ZMcpGenerateSurveyInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpGenerateSurveyInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const authentication = getMcpAuthentication(authInfo);
      const response =
        (await applyToolRateLimit(rateLimitConfigs.api.v3SurveyGenerate, authentication, requestId)) ??
        (await generateV3Survey({ authentication, body: input, requestId, instance: MCP_API_ROUTE }));

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
