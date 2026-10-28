import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZWorkspaceUpdateBrandingInput } from "@/modules/ee/whitelabel/remove-branding/types/workspace";

export const ZWorkspaceBrandingParams = z.object({ workspaceId: ZId });

/** Whether link and in-app surveys show the Formbricks badge. Either or both, never neither. */
export const ZWorkspaceBrandingPatchBody = ZWorkspaceUpdateBrandingInput.strict().refine(
  (body) => body.linkSurveyBranding !== undefined || body.inAppSurveyBranding !== undefined,
  { error: "Provide at least one field to update." }
);

export type TWorkspaceBrandingPatchBody = z.infer<typeof ZWorkspaceBrandingPatchBody>;
