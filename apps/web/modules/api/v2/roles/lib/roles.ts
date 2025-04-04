import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponse } from "@/modules/api/v2/types/api-success";
import { OrganizationRole } from "@prisma/client";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getRoles = async (): Promise<Result<ApiResponse<string[]>, ApiErrorResponseV2>> => {
  try {
    // Get all values from the OrganizationRole enum
    const roles = Object.values(OrganizationRole);

    if (!roles || roles.length === 0) {
      // We set internal_server_error because it's an enum and we should always have the roles
      return err({ type: "internal_server_error", details: [{ field: "roles", issue: "not found" }] });
    }

    // Filter out the billing role if not in Formbricks Cloud
    const filteredRoles = roles.filter((role) => !(role === "billing" && !IS_FORMBRICKS_CLOUD));

    return ok({
      data: filteredRoles,
    });
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "roles", issue: error.message }] });
  }
};
