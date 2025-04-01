"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationsWhereUserIsSingleOwner } from "@formbricks/lib/organization/service";
import { deleteUser } from "@formbricks/lib/user/service";
import { OperationNotAllowedError } from "@formbricks/types/errors";

export const deleteUserAction = authenticatedActionClient.action(async ({ ctx }) => {
  const isMultiOrgEnabled = false;
  const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(ctx.user.id);
  if (!isMultiOrgEnabled && organizationsWithSingleOwner.length > 0) {
    throw new OperationNotAllowedError(
      "You are the only owner of this organization. Please transfer ownership to another member first."
    );
  }
  return await deleteUser(ctx.user.id);
});
