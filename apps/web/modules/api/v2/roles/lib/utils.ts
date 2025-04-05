import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { OrganizationRole } from "@prisma/client";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { Result, ok } from "@formbricks/types/error-handlers";

export const getRoles = (): Result<{ data: string[] }, ApiErrorResponseV2> => {
  try {
    const roles = Object.values(OrganizationRole);

    // Filter out the billing role if not in Formbricks Cloud
    const filteredRoles = roles.filter((role) => !(role === "billing" && !IS_FORMBRICKS_CLOUD));
    return ok({
      data: filteredRoles,
    });
  } catch (err) {
    return err({
      type: "internal_server_error",
      details: [{ field: "roles", issue: "Failed to get roles" }],
    });
  }
};
