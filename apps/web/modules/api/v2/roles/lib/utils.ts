import { OrganizationRole } from "@formbricks/database/prisma";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getRoles = (): Result<{ data: string[] }, ApiErrorResponseV2> => {
  try {
    const roles = Object.values(OrganizationRole);

    // Filter out the billing role if not in Formbricks Cloud, and the Dashboard viewer always: this API
    // cannot assign it (ADR-0023), so listing it would advertise a role every write here refuses.
    const filteredRoles = roles.filter(
      (role) => role !== "dashboard_viewer" && !(role === "billing" && !IS_FORMBRICKS_CLOUD)
    );
    return ok({
      data: filteredRoles,
    });
  } catch {
    return err({
      type: "internal_server_error",
      details: [{ field: "roles", issue: "Failed to get roles" }],
    });
  }
};
