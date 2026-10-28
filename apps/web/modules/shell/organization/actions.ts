"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { deleteOrganization, getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getTranslate } from "@/lingodotdev/server";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

/*
 * Relocated, not new: `deleteOrganizationAction` moved here from the old `(app)` tree
 * (`app/(app)/workspaces/[workspaceId]/settings/organization/general/actions.ts`). Creating workspaces is
 * the agent's job now (`create_workspace`), so there is no create action here any more.
 */

const ZDeleteOrganizationAction = z.object({
  organizationId: ZId,
});

export const deleteOrganizationAction = authenticatedActionClient
  .inputSchema(ZDeleteOrganizationAction)
  .action(
    withAuditLogging("deleted", "organization", async ({ ctx, parsedInput }) => {
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();
      if (!isMultiOrgEnabled) {
        const t = await getTranslate(ctx.user.locale);
        throw new OperationNotAllowedError(t("workspace.settings.general.organization_deletion_disabled"));
      }

      await assertCan({ type: "user", id: ctx.user.id }, "organization.write", {
        type: "organization",
        id: parsedInput.organizationId,
      });
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      const oldObject = await getOrganization(parsedInput.organizationId);
      ctx.auditLoggingCtx.oldObject = oldObject;
      return await deleteOrganization(parsedInput.organizationId);
    })
  );
