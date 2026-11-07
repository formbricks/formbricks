import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";

type TBrandingInput = Readonly<{ inAppSurveyBranding?: boolean; linkSurveyBranding?: boolean }>;

/**
 * The remove-branding licence gate, for every write that can set a workspace's branding: creating a
 * workspace, the workspace settings update and the branding update. Setting either field at all needs
 * the licence, as it always has on update, so no entry point can store a value the others would refuse
 * (ENG-6840).
 */
export const assertBrandingChangeAllowed = async (
  organizationId: string,
  data: TBrandingInput
): Promise<void> => {
  if (data.inAppSurveyBranding === undefined && data.linkSurveyBranding === undefined) return;

  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  if (await getRemoveBrandingPermission(organizationId)) return;

  if (data.inAppSurveyBranding !== undefined) {
    throw new OperationNotAllowedError("You are not allowed to remove in-app branding");
  }
  throw new OperationNotAllowedError("You are not allowed to remove link survey branding");
};
