import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";

export const checkWhiteLabelPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isWhiteLabelAllowed = await getWhiteLabelPermission(organizationId);

  if (!isWhiteLabelAllowed) {
    throw new OperationNotAllowedError("White label is not allowed for this organization");
  }
};
