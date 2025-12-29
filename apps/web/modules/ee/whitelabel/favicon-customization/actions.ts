"use server";

import { z } from "zod";
import { ZId, ZUrl } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { checkWhiteLabelPermission } from "@/modules/ee/whitelabel/email-customization/actions";
import {
  removeOrganizationFaviconUrl,
  updateOrganizationFaviconUrl,
} from "@/modules/ee/whitelabel/favicon-customization/lib/organization";

const ZUpdateOrganizationFaviconUrlAction = z.object({
  organizationId: ZId,
  faviconUrl: ZUrl,
});

export const updateOrganizationFaviconUrlAction = authenticatedActionClient
  .schema(ZUpdateOrganizationFaviconUrlAction)
  .action(
    withAuditLogging(
      "updated",
      "organization",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZUpdateOrganizationFaviconUrlAction>;
      }) => {
        const { organizationId, faviconUrl } = parsedInput;

        await checkAuthorizationUpdated({
          userId: ctx.user.id,
          organizationId,
          access: [
            {
              type: "organization",
              roles: ["owner", "manager"],
            },
          ],
        });

        await checkWhiteLabelPermission(organizationId);

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.newObject = { faviconUrl };

        return await updateOrganizationFaviconUrl(organizationId, faviconUrl);
      }
    )
  );

const ZRemoveOrganizationFaviconUrlAction = z.object({
  organizationId: ZId,
});

export const removeOrganizationFaviconUrlAction = authenticatedActionClient
  .schema(ZRemoveOrganizationFaviconUrlAction)
  .action(
    withAuditLogging(
      "updated",
      "organization",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZRemoveOrganizationFaviconUrlAction>;
      }) => {
        const { organizationId } = parsedInput;

        await checkAuthorizationUpdated({
          userId: ctx.user.id,
          organizationId,
          access: [{ type: "organization", roles: ["owner", "manager"] }],
        });

        await checkWhiteLabelPermission(organizationId);

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.oldObject = { faviconUrl: "" };

        return await removeOrganizationFaviconUrl(organizationId);
      }
    )
  );
