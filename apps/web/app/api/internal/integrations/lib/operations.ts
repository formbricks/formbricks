import "server-only";
import { AuthenticationError, OperationNotAllowedError, UnknownError } from "@formbricks/types/errors";
import type { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { applyRateLimitOrRespond } from "@/app/api/internal/lib/rate-limit";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  noContentResponse,
  problemBadGateway,
  problemBadRequest,
  problemConflict,
  problemNotFound,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION,
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES,
  GOOGLE_SHEET_INTEGRATION_INVALID_GRANT,
} from "@/lib/googleSheet/constants";
import { getSpreadsheetNameById, validateGoogleSheetsConnection } from "@/lib/googleSheet/service";
import { withStoredIntegrationKey } from "@/lib/integration/redact-credentials";
import {
  createOrUpdateIntegration,
  deleteIntegration,
  getIntegrationByType,
} from "@/lib/integration/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getSlackChannels } from "@/lib/slack/service";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  type TIntegrationConflictReason,
  type TIntegrationConnectionResource,
  type TIntegrationPutBody,
  type TIntegrationTypeParam,
  parseIntegrationInput,
} from "../schemas";

/**
 * A workspace's OAuth integrations (Google Sheets, Airtable, Notion, Slack), addressed by workspace and
 * type — a workspace has at most one of each. Every route asks for write access to the workspace, as the
 * settings pages that use them do: even the provider reads only serve configuring an integration.
 *
 * The provider's OAuth credentials (`config.key`) never leave the server: writes keep the stored key
 * whatever the client sends, and answer with the integration's id only (ENG-2292).
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
  const userId =
    context.authentication && "user" in context.authentication ? context.authentication.user.id : "";
  return { ...access, userId };
}

/** `PUT /api/internal/integrations/{type}?workspaceId=`: store an integration's mappings and settings. */
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
  // Bound before any lookup: every call past this point reads the stored integration and writes the
  // provider config plus an audit entry.
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.integrationMutation,
    userId,
    context
  );
  if (limited) return limited;

  // The settings pages hand the client a redacted integration and echo it back whole on every add, edit
  // and delete of a mapping, so a client-sent `config.key` is blank or forged. The stored credentials are
  // the only source of truth, merged in before validating; only the OAuth callbacks write them. With
  // nothing stored the configuration has no credentials and is refused: connect first.
  const stored = await getIntegrationByType(workspaceId, type);
  const config = (body as { config: Record<string, unknown> }).config;
  const parsed = parseIntegrationInput(withStoredIntegrationKey({ type, config }, stored));
  if (!parsed.success) {
    return problemBadRequest(requestId, "Invalid integration configuration", {
      instance,
      invalid_params: parsed.error.issues.map((issue) => ({
        name: issue.path.join("."),
        reason: issue.message,
      })),
    });
  }

  const integration = await createOrUpdateIntegration(workspaceId, parsed.data);

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

/** `GET /api/internal/integrations/googleSheets/connection?workspaceId=`: does the stored grant still work? */
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
 * name, read with the workspace's stored grant — never one the client supplies.
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

/** Slack's own error codes for a grant that has to be renewed. */
const SLACK_REAUTHORIZATION_ERRORS = ["missing_scope", "invalid_auth"];

/** `GET /api/internal/integrations/slack/channels?workspaceId=`: the channels a mapping can post to. */
export async function getSlackChannelsOperation(context: TRequestContext): Promise<Response> {
  const access = await authorize(context);
  if (access instanceof Response) return access;

  try {
    return successResponse(await getSlackChannels(context.workspaceId), { requestId: context.requestId });
  } catch (error) {
    if (error instanceof UnknownError) {
      if (SLACK_REAUTHORIZATION_ERRORS.some((code) => error.message.includes(code))) {
        return conflict(context, "reauthorization_required", "Slack has to be reconnected");
      }
      return problemBadGateway(context.requestId, "Slack did not return the channels.", context.instance);
    }
    throw error;
  }
}
