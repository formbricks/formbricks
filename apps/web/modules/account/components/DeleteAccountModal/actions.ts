"use server";

import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { deleteUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { OperationNotAllowedError } from "@formbricks/types/errors";

export const deleteUserAction = authenticatedActionClient.action(async ({ ctx }) => {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(ctx.user.id);
  if (!isMultiOrgEnabled && organizationsWithSingleOwner.length > 0) {
    throw new OperationNotAllowedError(
      "You are the only owner of this organization. Please transfer ownership to another member first."
    );
  }
  return await deleteUser(ctx.user.id);
});
