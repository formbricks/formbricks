"use server";

import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { createProject } from "@/modules/projects/settings/lib/project";
import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { TUserNotificationSettings } from "@formbricks/types/user";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string().min(1, "Organization name must be at least 1 character long"),
});

export const createOrganizationAction = authenticatedActionClient.schema(ZCreateOrganizationAction).action(
  withAuditLogging(
    "created",
    "organization",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
          new Set([...(ctx.user.notificationSettings?.unsubscribedOrganizationIds || []), newOrganization.id]) // NOSONAR // We want to check for empty strings too
        ),
      };

      await updateUser(ctx.user.id, {
        notificationSettings: updatedNotificationSettings,
      });

      ctx.auditLoggingCtx.organizationId = newOrganization.id;
      ctx.auditLoggingCtx.newObject = newOrganization;

      return newOrganization;
    }
  )
);
