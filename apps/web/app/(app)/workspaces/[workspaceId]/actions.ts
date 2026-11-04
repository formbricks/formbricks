"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { assertCan } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationWorkspacesCount } from "@/lib/workspace/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  listDashboardViewerOrganizations,
  listDashboardViewerWorkspaces,
} from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  getAccessControlPermission,
  getOrganizationWorkspacesLimit,
} from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import { getOrganizationsByUserId } from "./lib/organization";
import { getWorkspacesByUserId, getWritableWorkspacesByUserId } from "./lib/workspace";

const ZCreateWorkspaceAction = z.object({
  organizationId: ZId,
  data: ZWorkspaceUpdateInput,
});

export const createWorkspaceAction = authenticatedActionClient.inputSchema(ZCreateWorkspaceAction).action(
  withAuditLogging("created", "workspace", async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    const organizationId = parsedInput.organizationId;

    await assertCan({ type: "user", id: user.id }, "organization.manage", {
      type: "organization",
      id: parsedInput.organizationId,
    });
    // Defence in depth for ENG-3921: bounds how wide a burst can be. The lock below is what
    // enforces the cap.
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.organizationId);

    const organization = await getOrganization(organizationId);

    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const [workspaceLimit, workspaceCount] = await Promise.all([
      getOrganizationWorkspacesLimit(organization.id),
      getOrganizationWorkspacesCount(organization.id),
    ]);

    // A fast path for the common case, before the access-control lookup and the transaction. It
    // cannot enforce the cap on its own (concurrent requests all read the same count), so
    // createWorkspace checks again under a lock on the organization (ENG-3921).
    if (workspaceCount >= workspaceLimit) {
      throw new OperationNotAllowedError("Organization workspace limit reached");
    }

    if (parsedInput.data.teamIds && parsedInput.data.teamIds.length > 0) {
      const isAccessControlAllowed = await getAccessControlPermission(organization.id);

      if (!isAccessControlAllowed) {
        throw new OperationNotAllowedError("You do not have permission to manage roles");
      }
    }

    const workspace = await createWorkspace(parsedInput.organizationId, parsedInput.data, {
      workspaceLimit,
    });
    const updatedNotificationSettings = {
      ...user.notificationSettings,
      alert: {
        ...user.notificationSettings?.alert,
      },
    };

    await updateUser(user.id, {
      notificationSettings: updatedNotificationSettings,
    });

    groupIdentifyPostHog("workspace", workspace.id, { name: workspace.name });

    capturePostHogEvent(
      user.id,
      "workspace_created",
      {
        organization_id: organizationId,
        workspace_id: workspace.id,
        name: workspace.name,
      },
      { organizationId, workspaceId: workspace.id }
    );

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.workspaceId = workspace.id;
    ctx.auditLoggingCtx.newObject = workspace;
    return workspace;
  })
);

/**
 * Fetches organizations list for switcher dropdown.
 * Called on-demand when user opens the organization switcher.
 */
export const getOrganizationsForSwitcherAction = authenticatedActionClient.action(async ({ ctx }) => {
  // The list is the caller's own organizations: those SpiceDB grants them `organization.read` on, plus
  // those where they are a Dashboard viewer (ADR-0023), whose relation reaches dashboard reads only.
  // Scoped by the user alone, so it needs no gate, and none that skips by role.
  const [organizations, viewerOrganizations] = await Promise.all([
    getOrganizationsByUserId(ctx.user.id),
    listDashboardViewerOrganizations(ctx.user.id),
  ]);
  const known = new Set(organizations.map(({ id }) => id));
  return [...organizations, ...viewerOrganizations.filter(({ id }) => !known.has(id))];
});

const ZGetWorkspacesForSwitcherAction = z.object({
  organizationId: ZId, // Changed from workspaceId to avoid extra query
});

/**
 * Fetches workspaces list for switcher dropdown.
 * Called on-demand when user opens the workspace switcher.
 */
export const getWorkspacesForSwitcherAction = authenticatedActionClient
  .inputSchema(ZGetWorkspacesForSwitcherAction)
  .action(async ({ ctx, parsedInput }) => {
    // A Dashboard viewer switches between the workspaces its teams are granted, and no others.
    const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, parsedInput.organizationId);
    if (membership?.role === "dashboard_viewer") {
      return await listDashboardViewerWorkspaces(ctx.user.id, parsedInput.organizationId);
    }

    await assertCan({ type: "user", id: ctx.user.id }, "organization.read", {
      type: "organization",
      id: parsedInput.organizationId,
    });

    return await getWorkspacesByUserId(ctx.user.id, parsedInput.organizationId);
  });

const ZGetWritableWorkspacesAction = z.object({
  organizationId: ZId,
});

/**
 * Fetches workspaces the user can write to (org owner/manager, or team member with readWrite).
 * Used by flows that target a workspace for a write operation (e.g. copy survey).
 */
export const getWritableWorkspacesAction = authenticatedActionClient
  .inputSchema(ZGetWritableWorkspacesAction)
  .action(async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "organization.read_access", {
      type: "organization",
      id: parsedInput.organizationId,
    });

    return await getWritableWorkspacesByUserId(ctx.user.id, parsedInput.organizationId);
  });
