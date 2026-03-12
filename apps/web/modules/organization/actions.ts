"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { createProject } from "@/modules/projects/settings/lib/project";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string().min(1, "Organization name must be at least 1 character long"),
});

export const createOrganizationAction = authenticatedActionClient
  .inputSchema(ZCreateOrganizationAction)
  .action(
    withAuditLogging("created", "organization", async ({ ctx, parsedInput }) => {
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

      // Stripe setup must run AFTER membership is created so the owner email is available
      if (IS_FORMBRICKS_CLOUD) {
        ensureCloudStripeSetupForOrganization(newOrganization.id).catch((error) => {
          logger.error(
            { error, organizationId: newOrganization.id },
            "Stripe setup failed after organization creation"
          );
        });
      }

      await createProject(newOrganization.id, {
        name: "My Project",
      });

      const updatedNotificationSettings: TUserNotificationSettings = {
        ...ctx.user.notificationSettings,
        alert: {
          ...ctx.user.notificationSettings?.alert,
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
    })
  );
