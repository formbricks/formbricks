"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProjectUpdateInput } from "@formbricks/types/project";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getOrganizationProjectsCount } from "@/lib/project/service";
import { updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  getAccessControlPermission,
  getOrganizationProjectsLimit,
} from "@/modules/ee/license-check/lib/utils";
import { createProject } from "@/modules/projects/settings/lib/project";
import { getOrganizationsByUserId } from "./lib/organization";
import { getProjectsByUserId } from "./lib/project";

const ZCreateProjectAction = z.object({
  organizationId: ZId,
  data: ZProjectUpdateInput,
});

export const createProjectAction = authenticatedActionClient.schema(ZCreateProjectAction).action(
  withAuditLogging(
    "created",
    "project",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const { user } = ctx;

      const organizationId = parsedInput.organizationId;

      await checkAuthorizationUpdated({
        userId: user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            data: parsedInput.data,
            schema: ZProjectUpdateInput,
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      const organization = await getOrganization(organizationId);

      if (!organization) {
        throw new Error("Organization not found");
      }

      const organizationProjectsLimit = await getOrganizationProjectsLimit(organization.billing.limits);
      const organizationProjectsCount = await getOrganizationProjectsCount(organization.id);

      if (organizationProjectsCount >= organizationProjectsLimit) {
        throw new OperationNotAllowedError("Organization project limit reached");
      }

      if (parsedInput.data.teamIds && parsedInput.data.teamIds.length > 0) {
        const isAccessControlAllowed = await getAccessControlPermission(organization.billing.plan);

        if (!isAccessControlAllowed) {
          throw new OperationNotAllowedError("You do not have permission to manage roles");
        }
      }

      const project = await createProject(parsedInput.organizationId, parsedInput.data);
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
      ctx.auditLoggingCtx.projectId = project.id;
      ctx.auditLoggingCtx.newObject = project;
      return project;
    }
  )
);

const ZGetOrganizationsForSwitcherAction = z.object({
  organizationId: ZId, // Changed from environmentId to avoid extra query
});

/**
 * Fetches organizations list for switcher dropdown.
 * Called on-demand when user opens the organization switcher.
 */
export const getOrganizationsForSwitcherAction = authenticatedActionClient
  .schema(ZGetOrganizationsForSwitcherAction)
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

const ZGetProjectsForSwitcherAction = z.object({
  organizationId: ZId, // Changed from environmentId to avoid extra query
});

/**
 * Fetches projects list for switcher dropdown.
 * Called on-demand when user opens the project switcher.
 */
export const getProjectsForSwitcherAction = authenticatedActionClient
  .schema(ZGetProjectsForSwitcherAction)
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

    // Need membership for getProjectsByUserId (1 DB query)
    const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, parsedInput.organizationId);
    if (!membership) {
      throw new Error("Membership not found");
    }

    return await getProjectsByUserId(ctx.user.id, membership);
  });
