import "server-only";
import { logger } from "@formbricks/logger";
import type { TCustomCssStored } from "@formbricks/types/custom-css";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { getV3AuthorizationActor, requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  capCustomCssIssues,
  customCssErrorsToInvalidParams,
  toV3WriteExtensions,
} from "@/app/api/v3/lib/custom-css";
import { getV3CustomCssPrincipal } from "@/app/api/v3/lib/custom-css-rate-limit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemBadRequest,
  problemCustomCssInvalid,
  problemCustomCssPlanRequired,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import {
  type TV3WorkspaceCustomCssResource,
  ZV3WorkspaceCustomCssPatchBody,
} from "@/app/api/v3/workspaces/lib/custom-css-schemas";
import {
  CUSTOM_CSS_PLAN_REQUIRED_MESSAGE,
  WORKSPACE_CUSTOM_CSS_PERMISSION_MESSAGE,
  canWriteWorkspaceCustomCss,
  getCustomCssPlanAllowed,
} from "@/modules/custom-css/lib/access";
import { getCustomCssHealth } from "@/modules/custom-css/lib/delivery";
import {
  getWorkspaceCustomCssRecord,
  toCustomCssSource,
  updateWorkspaceCustomCss,
} from "@/modules/custom-css/lib/service";

type TOperationParams = {
  workspaceId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

const serializeResource = async (
  context: V3WorkspaceContext,
  record: { customCss: TCustomCssStored | null; previous: TCustomCssStored | null },
  authentication: TV3Authentication
): Promise<TV3WorkspaceCustomCssResource> => {
  const [health, canEdit, planAllowed] = await Promise.all([
    getCustomCssHealth(record.customCss, "workspace"),
    canWriteWorkspaceCustomCss(getV3AuthorizationActor(authentication), context),
    getCustomCssPlanAllowed(context.organizationId),
  ]);

  return {
    workspaceId: context.workspaceId,
    customCss: toCustomCssSource(record.customCss),
    previous: toCustomCssSource(record.previous),
    status: health.status,
    ...(health.status === "withheld" ? { errors: capCustomCssIssues(health.errors) } : {}),
    canEdit,
    planAllowed,
  };
};

/** `GET /api/v3/workspaces/{workspaceId}/custom-css` — readable by anyone with read access to the workspace. */
export async function getV3WorkspaceCustomCss({
  workspaceId,
  authentication,
  requestId,
  instance,
}: TOperationParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const context = await requireV3WorkspaceAccess(authentication, workspaceId, "read", requestId, instance);
    if (context instanceof Response) {
      return context;
    }

    const record = await getWorkspaceCustomCssRecord(context.workspaceId);
    return successResponse(await serializeResource(context, record, authentication), {
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "workspaces.customCss.get" });
  }
}

/**
 * `PATCH /api/v3/workspaces/{workspaceId}/custom-css` (ENG-2949, ENG-3641). Authorization is enforced
 * here, not by the route wrapper, so the MCP tool that calls this directly gets the same answer.
 */
export async function patchV3WorkspaceCustomCss({
  workspaceId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TOperationParams & { body: unknown; auditLog?: TV3AuditLog }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const parsed = ZV3WorkspaceCustomCssPatchBody.safeParse(body);
    if (!parsed.success) {
      const invalidParams = formatZodIssues(parsed.error, "body");
      log.warn({ statusCode: 400, invalidParams }, "Workspace custom CSS request failed validation");
      return problemBadRequest(requestId, "Invalid request body", {
        invalid_params: invalidParams,
        instance,
      });
    }

    // Read access first, so an unreachable workspace answers exactly like any other v3 resource.
    const context = await requireV3WorkspaceAccess(authentication, workspaceId, "read", requestId, instance);
    if (context instanceof Response) {
      return context;
    }

    if (auditLog) {
      auditLog.organizationId = context.organizationId;
      auditLog.targetId = context.workspaceId;
    }

    if (!(await canWriteWorkspaceCustomCss(getV3AuthorizationActor(authentication), context))) {
      log.warn({ statusCode: 403 }, "Workspace custom CSS write refused for this principal");
      return problemForbidden(requestId, WORKSPACE_CUSTOM_CSS_PERMISSION_MESSAGE, instance);
    }

    // The service charges the custom CSS budget only when the save processes CSS; a spent budget throws
    // `TooManyRequestsError`, which answers 429 below.
    const outcome = await updateWorkspaceCustomCss({
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      input: parsed.data.customCss,
      principal: getV3CustomCssPrincipal(authentication),
    });

    if (!outcome.ok) {
      if (outcome.code === "plan_required") {
        log.warn({ statusCode: 403 }, "Workspace custom CSS change needs the Scale plan");
        return problemCustomCssPlanRequired(requestId, CUSTOM_CSS_PLAN_REQUIRED_MESSAGE, instance);
      }
      log.warn({ statusCode: 422, errorCount: outcome.errors.length }, "Workspace custom CSS rejected");
      return problemCustomCssInvalid(requestId, {
        invalid_params: customCssErrorsToInvalidParams(outcome.errors),
        errors: capCustomCssIssues(outcome.errors),
        instance,
      });
    }

    const record = await getWorkspaceCustomCssRecord(context.workspaceId);
    const resource = await serializeResource(context, record, authentication);

    if (!outcome.changed) {
      // Same normalized source as stored: nothing was written, so there is nothing to audit.
      skipV3AuditLog(auditLog);
    } else if (auditLog) {
      // Source only on both sides: the audit trail records what the creator wrote, not compiled output.
      // Both sides come from the save itself, so a concurrent writer cannot skew the pair.
      auditLog.oldObject = { customCss: toCustomCssSource(outcome.replaced) };
      auditLog.newObject = { customCss: toCustomCssSource(outcome.stored) };
    }

    log.info({ statusCode: 200, changed: outcome.changed }, "Workspace custom CSS saved");
    return successResponse(resource, {
      requestId,
      cache: "private, no-store",
      extensions: toV3WriteExtensions({ customCssWarnings: outcome.warnings }),
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "workspaces.customCss.patch" });
  }
}
