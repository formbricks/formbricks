import { z } from "zod";

export const ZWorkspaceUpdateBrandingInput = z.object({
  linkSurveyBranding: z.boolean().optional(),
  inAppSurveyBranding: z.boolean().optional(),
});

export type TWorkspaceUpdateBrandingInput = z.infer<typeof ZWorkspaceUpdateBrandingInput>;
