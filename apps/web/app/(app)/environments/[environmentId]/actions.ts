"use server";

import { getOrganization } from "@/lib/organization/service";
import { getOrganizationProjectsCount } from "@/lib/project/service";
import { updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  getOrganizationProjectsLimit,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { createProject } from "@/modules/projects/settings/lib/project";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProjectUpdateInput } from "@formbricks/types/project";

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
        const canDoRoleManagement = await getRoleManagementPermission(organization.billing.plan);

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

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = project.id;
      ctx.auditLoggingCtx.newObject = project;
      return project;
    }
  )
);
