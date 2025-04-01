"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { createProject } from "@/modules/projects/settings/lib/project";
import { z } from "zod";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { updateUser } from "@formbricks/lib/user/service";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { TUserNotificationSettings } from "@formbricks/types/user";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string().min(1, "Organization name must be at least 1 character long"),
});

export const createOrganizationAction = authenticatedActionClient
  .schema(ZCreateOrganizationAction)
  .action(async ({ ctx, parsedInput }) => {
    const isMultiOrgEnabled = false;
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
