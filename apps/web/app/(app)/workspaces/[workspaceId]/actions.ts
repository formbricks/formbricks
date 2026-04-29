"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  AuthorizationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationWorkspacesCount } from "@/lib/workspace/service";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  getAccessControlPermission,
  getOrganizationWorkspacesLimit,
} from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import { getOrganizationsByUserId } from "./lib/organization";
import { getWorkspacesByUserId } from "./lib/workspace";

const ZCreateWorkspaceInput = ZWorkspaceUpdateInput.extend({
  feedbackRecordDirectoryId: ZId.optional(),
});

const ZCreateWorkspaceAction = z.object({
  organizationId: ZId,
  data: ZCreateWorkspaceInput,
});

export const createWorkspaceAction = authenticatedActionClient.inputSchema(ZCreateWorkspaceAction).action(
  withAuditLogging("created", "workspace", async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    const organizationId = parsedInput.organizationId;

    await checkAuthorizationUpdated({
      userId: user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          data: parsedInput.data,
          schema: ZCreateWorkspaceInput,
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const organization = await getOrganization(organizationId);

    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const organizationWorkspacesLimit = await getOrganizationWorkspacesLimit(organization.id);
    const organizationWorkspacesCount = await getOrganizationWorkspacesCount(organization.id);

    if (organizationWorkspacesCount >= organizationWorkspacesLimit) {
      throw new OperationNotAllowedError("Organization workspace limit reached");
    }

    if (parsedInput.data.teamIds && parsedInput.data.teamIds.length > 0) {
      const isAccessControlAllowed = await getAccessControlPermission(organization.id);

      if (!isAccessControlAllowed) {
        throw new OperationNotAllowedError("You do not have permission to manage roles");
      }
    }

    const workspace = await createWorkspace(parsedInput.organizationId, parsedInput.data);
    const updatedNotificationSettings = {
      ...user.notificationSettings,
      alert: {
        ...user.notificationSettings?.alert,
      },
    };

    await updateUser(user.id, {
      notificationSettings: updatedNotificationSettings,
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.workspaceId = workspace.id;
    ctx.auditLoggingCtx.newObject = workspace;
    return workspace;
  })
);

const ZGetOrganizationsForSwitcherAction = z.object({
  organizationId: ZId, // Changed from workspaceId to avoid extra query
});

/**
 * Fetches organizations list for switcher dropdown.
 * Called on-demand when user opens the organization switcher.
 */
export const getOrganizationsForSwitcherAction = authenticatedActionClient
  .inputSchema(ZGetOrganizationsForSwitcherAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member", "billing"],
        },
      ],
    });

    return await getOrganizationsByUserId(ctx.user.id);
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member", "billing"],
        },
      ],
    });

    // Need membership for getWorkspacesByUserId (1 DB query)
    const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, parsedInput.organizationId);
    if (!membership) {
      throw new AuthorizationError("Membership not found");
    }

    return await getWorkspacesByUserId(ctx.user.id, membership);
  });
