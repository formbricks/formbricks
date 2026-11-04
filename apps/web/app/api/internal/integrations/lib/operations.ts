import "server-only";
import {
  AuthenticationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import type { TIntegrationInput } from "@formbricks/types/integration";
import type { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import { getV3SessionUserId, requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemBadGateway,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemNotFound,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION,
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES,
  GOOGLE_SHEET_INTEGRATION_INVALID_GRANT,
} from "@/lib/googleSheet/constants";
import { getSpreadsheetNameById, validateGoogleSheetsConnection } from "@/lib/googleSheet/service";
import {
  createOrUpdateIntegration,
  deleteIntegration,
  getIntegrationByType,
} from "@/lib/integration/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { SlackApiError } from "@/lib/slack/errors";
import { getSlackChannels } from "@/lib/slack/service";
import { SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE } from "@/lib/survey/visibility/outbound";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  type TIntegrationConflictReason,
  type TIntegrationConnectionResource,
  type TIntegrationPutBody,
  type TIntegrationTypeParam,
  ZIntegrationPutBodyByType,
} from "../schemas";

/**
 * A workspace's OAuth integrations (Google Sheets, Airtable, Notion, Slack), addressed by workspace and
 * type — a workspace has at most one of each. Every route asks for write access to the workspace, as the
 * settings pages that use them do: even the provider reads only serve configuring an integration.
 *
 * The provider's OAuth credentials (`config.key`) never leave the server: a write takes only the mappings,
 * keeps the stored credentials, and answers with the integration's id only (ENG-2292).
 */

type TRequestContext = {
  authentication: TV3Authentication;
  workspaceId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

const conflict = (
  { requestId, instance }: TRequestContext,
  reason: TIntegrationConflictReason,
  detail: string
) => problemConflict(requestId, detail, instance, { details: { reason } });

/** Write access to the workspace, for a session user; their id is what the write budgets are keyed by. */
async function authorize(context: TRequestContext) {
  const access = await requireSessionWorkspaceAccess(
    context.authentication,
    context.workspaceId,
    "readWrite",
    context.requestId,
    context.instance
  );
  if (access instanceof Response) return access;
  const userId = getV3SessionUserId(context.authentication);
  if (!userId) return problemUnauthorized(context.requestId, "Session required", context.instance);
  return { ...access, userId };
}

/** `PUT /api/internal/integrations/{type}?workspaceId=`: replace an integration's mappings. */
export async function putIntegrationOperation({
  type,
  body,
  ...context
}: TRequestContext & { type: TIntegrationTypeParam; body: TIntegrationPutBody }): Promise<Response> {
  const { workspaceId, requestId, instance, auditLog } = context;
  const access = await authorize(context);
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;
  const { userId } = access;
  // Bound right after authorization: every call past this point reads the stored integration and writes
  // the provider config plus an audit entry.
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.integrationMutation,
    userId,
    context
  );
  if (limited) return limited;

  const parsed = ZIntegrationPutBodyByType[type].safeParse(body);
  if (!parsed.success) {
    return problemBadRequest(requestId, "Invalid integration configuration", {
      instance,
      // Bounded like every other producer: one issue per bad mapping entry is caller-shaped (ENG-3384).
      invalid_params: formatZodIssues(parsed.error, "body"),
    });
  }

  // Credentials only ever come from the OAuth callbacks, which write the integration directly: one never
  // connected has nothing to configure here.
  const stored = await getIntegrationByType(workspaceId, type);
  if (!stored?.config?.key) {
    return conflict(context, "not_connected", "Connect the integration before configuring it.");
  }

  // The mappings go onto the stored integration, whose credentials and account go back exactly as stored:
  // parsing them would drop fields the schema doesn't name, such as parts of a provider's token response.
  let integration: Awaited<ReturnType<typeof createOrUpdateIntegration>>;
  try {
    integration = await createOrUpdateIntegration(workspaceId, {
      type,
      config: { ...stored.config, data: parsed.data.config.data },
    } as TIntegrationInput);
  } catch (error) {
    // ENG-3283: a survey restricted to some members can't feed an outbound integration.
    if (error instanceof OperationNotAllowedError && error.message === SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE) {
      return problemForbidden(requestId, error.message, instance, "survey_not_workspace_visible");
    }
    throw error;
  }

  if (auditLog) {
    auditLog.targetId = integration.id;
    auditLog.newObject = integration;
  }
  capturePostHogEvent(
    userId,
    "integration_connected",
    { integration_type: type, organization_id: access.organizationId, workspace_id: workspaceId },
    { organizationId: access.organizationId, workspaceId }
  );
  return successResponse({ id: integration.id }, { requestId });
}

/** `DELETE /api/internal/integrations/{type}?workspaceId=`: disconnect an integration. */
export async function deleteIntegrationOperation({
  type,
  ...context
}: TRequestContext & { type: TIntegrationTypeParam }): Promise<Response> {
  const { workspaceId, requestId, instance, auditLog } = context;
  const access = await authorize(context);
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;
  // Same budget as the writes: a delete is the cheapest way to churn integration rows.
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.integrationMutation,
    access.userId,
    context
  );
  if (limited) return limited;

  const integration = await getIntegrationByType(workspaceId, type);
  if (!integration) return problemNotFound(requestId, "Integration", type, instance);

  const deleted = await deleteIntegration(integration.id);
  if (auditLog) {
    auditLog.targetId = deleted.id;
    auditLog.oldObject = deleted;
  }
  return noContentResponse({ requestId });
}

/**
 * `GET /api/internal/integrations/googleSheets/connection?workspaceId=`: does the stored grant still work?
 *
 * Checking the grant, like reading a spreadsheet below, refreshes an expired access token and stores the
 * new one (`authorize` in `lib/googleSheet/service.ts`). That write stays on a GET, outside the origin
 * check: it is what every load of the settings page already does, a caller can't choose what it writes
 * (Google issues the token for the grant already stored), repeating it changes nothing a caller can
 * observe, and nothing it produces is readable cross-origin.
 */
export async function getGoogleSheetsConnectionOperation(context: TRequestContext): Promise<Response> {
  const access = await authorize(context);
  if (access instanceof Response) return access;

  const answer = (status: TIntegrationConnectionResource["status"]) =>
    successResponse<TIntegrationConnectionResource>({ status }, { requestId: context.requestId });

  const integration = await getIntegrationByType(context.workspaceId, "googleSheets");
  if (!integration) return answer("not_connected");
  try {
    await validateGoogleSheetsConnection(integration as TIntegrationGoogleSheets);
    return answer("connected");
  } catch (error) {
    if (error instanceof AuthenticationError && error.message === GOOGLE_SHEET_INTEGRATION_INVALID_GRANT) {
      return answer("reauthorization_required");
    }
    throw error;
  }
}

/**
 * `GET /api/internal/integrations/googleSheets/spreadsheets/{spreadsheetId}?workspaceId=`: a spreadsheet's
 * name, read with the workspace's stored grant — never one the client supplies. Refreshes an expired
 * token as the connection check does. A spreadsheet Google doesn't know is the caller's 404; Google
 * failing to answer is a 502.
 */
export async function getSpreadsheetOperation({
  spreadsheetId,
  ...context
}: TRequestContext & { spreadsheetId: string }): Promise<Response> {
  const access = await authorize(context);
  if (access instanceof Response) return access;

  const integration = await getIntegrationByType(context.workspaceId, "googleSheets");
  if (!integration) return conflict(context, "not_connected", "Google Sheets is not connected");

  try {
    const name = await getSpreadsheetNameById(integration as TIntegrationGoogleSheets, spreadsheetId);
    return successResponse({ id: spreadsheetId, name }, { requestId: context.requestId });
  } catch (error) {
    if (error instanceof AuthenticationError && error.message === GOOGLE_SHEET_INTEGRATION_INVALID_GRANT) {
      return conflict(context, "invalid_grant", error.message);
    }
    if (
      error instanceof OperationNotAllowedError &&
      (error.message === GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION ||
        error.message === GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES)
    ) {
      return conflict(context, error.message, error.message);
    }
    if (error instanceof ResourceNotFoundError) {
      return problemNotFound(context.requestId, "Spreadsheet", spreadsheetId, context.instance);
    }
    if (error instanceof UnknownError) {
      return problemBadGateway(
        context.requestId,
        "Google Sheets could not read the spreadsheet.",
        context.instance
      );
    }
    throw error;
  }
}

/** Slack's own error codes for a grant that is gone or has to be renewed: reconnecting is the way out. */
const SLACK_REAUTHORIZATION_ERRORS = new Set([
  "invalid_auth",
  "not_authed",
  "missing_scope",
  "token_expired",
  "token_revoked",
  "account_inactive",
]);

/**
 * `GET /api/internal/integrations/slack/channels?workspaceId=`: the channels a mapping can post to. A
 * refused grant asks for a reconnect, any other Slack failure is a 502, and anything else is ours: a 500.
 */
export async function getSlackChannelsOperation(context: TRequestContext): Promise<Response> {
  const access = await authorize(context);
  if (access instanceof Response) return access;

  try {
    return successResponse(await getSlackChannels(context.workspaceId), { requestId: context.requestId });
  } catch (error) {
    if (error instanceof SlackApiError) {
      if (SLACK_REAUTHORIZATION_ERRORS.has(error.code)) {
        return conflict(context, "reauthorization_required", "Slack has to be reconnected");
      }
      return problemBadGateway(context.requestId, "Slack did not return the channels.", context.instance);
    }
    throw error;
  }
}
