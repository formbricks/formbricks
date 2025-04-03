import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponse } from "@/modules/api/v2/types/api-success";
import { prisma } from "@formbricks/database";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getRoles = async (): Promise<Result<ApiResponse<string[]>, ApiErrorResponseV2>> => {
  try {
    // We use a raw query to get all the roles because we can't list enum options with prisma
    const results = await prisma.$queryRaw<{ unnest: string }[]>`
        SELECT unnest(enum_range(NULL::"OrganizationRole"));
    `;

    if (!results) {
      // We set internal_server_error because it's an enum and we should always have the roles
      return err({ type: "internal_server_error", details: [{ field: "roles", issue: "not found" }] });
    }

    const roles = results
      .filter((row) => !(row.unnest === "billing" && !IS_FORMBRICKS_CLOUD))
      .map((row) => row.unnest);

    return ok({
      data: roles,
    });
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "roles", issue: error.message }] });
  }
};
