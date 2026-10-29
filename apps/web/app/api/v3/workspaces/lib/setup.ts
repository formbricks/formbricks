import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import type { TWorkspace } from "@formbricks/types/workspace";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { parseV3Body } from "@/app/api/v3/lib/parse-body";
import {
  createdResponse,
  problemConflict,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { problemHiddenResource, requireV3OrganizationManager } from "@/app/api/v3/organizations/lib/access";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { getOrganizationWorkspacesCount, getWorkspace } from "@/lib/workspace/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace, updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import { requireV3WorkspaceSetupAccess } from "./setup-access";
import { rejectEmptyChange } from "./setup-input";
import {
  type TV3WorkspaceSetupResource,
  ZV3WorkspaceCreateBody,
  ZV3WorkspaceUpdateBody,
} from "./setup-schemas";

type TSetupOperationParams = {
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

export const WORKSPACE_LIMIT_MESSAGE = "This organization has reached the workspace limit of its plan.";
export const WORKSPACE_NAME_TAKEN_MESSAGE = "A workspace with this name already exists in the organization.";

/** The minimal DTO a setup write answers with — never the raw workspace entity. */
export const serializeV3WorkspaceSetup = (workspace: TWorkspace): TV3WorkspaceSetupResource => ({
  id: workspace.id,
  name: workspace.name,
  organizationId: workspace.organizationId,
  channel: workspace.config?.channel ?? null,
  industry: workspace.config?.industry ?? null,
  updatedAt: workspace.updatedAt.toISOString(),
});

/**
 * Create a workspace in an organization the caller owns or manages (signed-in user only). Honours the
 * plan's workspace cap exactly as the old create-workspace action did: a fast check here, and the
 * authoritative one under the organization lock inside `createWorkspace`.
 */
export async function createV3Workspace({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TSetupOperationParams): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const parsed = parseV3Body(ZV3WorkspaceCreateBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;
    const { organizationId, name, channel, industry } = parsed.data;

    const access = await requireV3OrganizationManager(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Workspace creation refused for this principal");
      return access;
    }

    if (auditLog) {
      auditLog.organizationId = organizationId;
    }

    // Bounds how wide a burst can be; the lock inside `createWorkspace` is what enforces the cap (ENG-3921).
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);

    const organization = await getOrganization(organizationId);
    if (!organization) {
      return problemHiddenResource(requestId, instance);
    }

    const [workspaceLimit, workspaceCount] = await Promise.all([
      getOrganizationWorkspacesLimit(organizationId),
      getOrganizationWorkspacesCount(organizationId),
    ]);
    if (workspaceCount >= workspaceLimit) {
      return problemForbidden(requestId, WORKSPACE_LIMIT_MESSAGE, instance);
    }

    let workspace: TWorkspace;
    try {
      workspace = await createWorkspace(
        organizationId,
        { name, config: { channel: channel ?? null, industry: industry ?? null } },
        { workspaceLimit }
      );
    } catch (error) {
      if (error instanceof OperationNotAllowedError) {
        return problemForbidden(requestId, WORKSPACE_LIMIT_MESSAGE, instance);
      }
      if (error instanceof InvalidInputError) {
        return problemConflict(requestId, WORKSPACE_NAME_TAKEN_MESSAGE, instance);
      }
      throw error;
    }

    if (auditLog) {
      auditLog.targetId = workspace.id;
      auditLog.newObject = serializeV3WorkspaceSetup(workspace);
    }

    groupIdentifyPostHog("workspace", workspace.id, { name: workspace.name });
    capturePostHogEvent(
      access.userId,
      "workspace_created",
      { organization_id: organizationId, workspace_id: workspace.id, name: workspace.name },
      { organizationId, workspaceId: workspace.id }
    );

    log.info({ statusCode: 201, workspaceId: workspace.id }, "Workspace created");
    return createdResponse(serializeV3WorkspaceSetup(workspace), {
      location: `/api/v3/workspaces/${workspace.id}`,
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "workspaces.create" });
  }
}

/**
 * Rename a workspace and set its channel or industry. A partial update: only the keys named are written,
 * and `config` is merged onto what is stored now so an unrelated key some other surface wrote is kept.
 */
export async function updateV3Workspace({
  workspaceId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TSetupOperationParams & { workspaceId: string }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const parsed = parseV3Body(ZV3WorkspaceUpdateBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;
    const { name, channel, industry } = parsed.data;
    const empty = rejectEmptyChange({ name, channel, industry }, requestId, instance);
    if (empty) return empty;

    const context = await requireV3WorkspaceSetupAccess(authentication, workspaceId, requestId, instance);
    if (context instanceof Response) {
      return context;
    }

    if (auditLog) {
      auditLog.organizationId = context.organizationId;
      auditLog.targetId = context.workspaceId;
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, context.workspaceId);

    const previous = await getWorkspace(context.workspaceId);
    if (!previous) {
      return problemHiddenResource(requestId, instance);
    }

    if (name !== undefined && name !== previous.name) {
      const taken = await prisma.workspace.findFirst({
        where: { organizationId: context.organizationId, name, id: { not: context.workspaceId } },
        select: { id: true },
      });
      if (taken) {
        return problemConflict(requestId, WORKSPACE_NAME_TAKEN_MESSAGE, instance);
      }
    }

    const nextConfig = {
      ...previous.config,
      ...(channel === undefined ? {} : { channel }),
      ...(industry === undefined ? {} : { industry }),
    };
    const changed =
      (name !== undefined && name !== previous.name) ||
      nextConfig.channel !== previous.config?.channel ||
      nextConfig.industry !== previous.config?.industry;

    if (!changed) {
      skipV3AuditLog(auditLog);
      return successResponse(serializeV3WorkspaceSetup(previous), { requestId, cache: "private, no-store" });
    }

    const updated = await updateWorkspace(context.workspaceId, {
      ...(name === undefined ? {} : { name }),
      config: nextConfig,
    });

    if (auditLog) {
      auditLog.oldObject = serializeV3WorkspaceSetup(previous);
      auditLog.newObject = serializeV3WorkspaceSetup(updated);
    }

    log.info({ statusCode: 200 }, "Workspace updated");
    return successResponse(serializeV3WorkspaceSetup(updated), { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "workspaces.update" });
  }
}
