"use server";

import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { deleteUser, getUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { OperationNotAllowedError } from "@formbricks/types/errors";

export const deleteUserAction = authenticatedActionClient.action(
  withAuditLogging(
    "deleted",
    "user",
    async ({ ctx }: { ctx: AuthenticatedActionClientCtx; parsedInput: undefined }) => {
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();
      const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(ctx.user.id);
      if (!isMultiOrgEnabled && organizationsWithSingleOwner.length > 0) {
        throw new OperationNotAllowedError(
          "You are the only owner of this organization. Please transfer ownership to another member first."
        );
      }
      ctx.auditLoggingCtx.userId = ctx.user.id;
      ctx.auditLoggingCtx.oldObject = await getUser(ctx.user.id);
      const result = await deleteUser(ctx.user.id);
      return result;
    }
  )
);
