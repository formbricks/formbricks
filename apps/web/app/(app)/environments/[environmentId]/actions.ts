"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getIsMultiOrgEnabled,
  getOrganizationProjectsLimit,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { createMembership } from "@formbricks/lib/membership/service";
import {
  createOrganization,
  getOrganization,
  getOrganizationProjectsCount,
} from "@formbricks/lib/organization/service";
import { createProject } from "@formbricks/lib/project/service";
import { updateUser } from "@formbricks/lib/user/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProjectUpdateInput } from "@formbricks/types/project";
import { TUserNotificationSettings } from "@formbricks/types/user";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string(),
});

export const createOrganizationAction = authenticatedActionClient
  .schema(ZCreateOrganizationAction)
  .action(async ({ ctx, parsedInput }) => {
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();
    if (!isMultiOrgEnabled)
      throw new OperationNotAllowedError(
        "Creating Multiple organization is restricted on your instance of Formbricks"
      );

    const newOrganization = await createOrganization({
      name: parsedInput.organizationName,
    });

    await createMembership(newOrganization.id, ctx.user.id, {
      role: "owner",
      accepted: true,
    });

    const project = await createProject(newOrganization.id, {
      name: "My Project",
    });

    const updatedNotificationSettings: TUserNotificationSettings = {
      ...ctx.user.notificationSettings,
      alert: {
        ...ctx.user.notificationSettings?.alert,
      },
      weeklySummary: {
        ...ctx.user.notificationSettings?.weeklySummary,
        [project.id]: true,
      },
      unsubscribedOrganizationIds: Array.from(
        new Set([...(ctx.user.notificationSettings?.unsubscribedOrganizationIds || []), newOrganization.id])
      ),
    };

    await updateUser(ctx.user.id, {
      notificationSettings: updatedNotificationSettings,
    });

    return newOrganization;
  });

const ZCreateProjectAction = z.object({
  organizationId: ZId,
  data: ZProjectUpdateInput,
});

export const createProjectAction = authenticatedActionClient
  .schema(ZCreateProjectAction)
  .action(async ({ parsedInput, ctx }) => {
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

    const organizationProjectsLimit = await getOrganizationProjectsLimit(organization);
    const organizationProjectsCount = await getOrganizationProjectsCount(organization.id);

    if (organizationProjectsCount >= organizationProjectsLimit) {
      throw new OperationNotAllowedError("Organization project limit reached");
    }

    if (parsedInput.data.teamIds && parsedInput.data.teamIds.length > 0) {
      const canDoRoleManagement = await getRoleManagementPermission(organization);

      if (!canDoRoleManagement) {
        throw new OperationNotAllowedError("You do not have permission to manage roles");
      }
    }

    const project = await createProject(parsedInput.organizationId, parsedInput.data);
    const updatedNotificationSettings = {
      ...user.notificationSettings,
      alert: {
        ...user.notificationSettings?.alert,
      },
      weeklySummary: {
        ...user.notificationSettings?.weeklySummary,
        [project.id]: true,
      },
    };

    await updateUser(user.id, {
      notificationSettings: updatedNotificationSettings,
    });

    return project;
  });
