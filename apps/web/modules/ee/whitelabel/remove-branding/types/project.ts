import { z } from "zod";

export const ZProjectUpdateBrandingInput = z.object({
  linkSurveyBranding: z.boolean().optional(),
  inAppSurveyBranding: z.boolean().optional(),
});

export type TProjectUpdateBrandingInput = z.infer<typeof ZProjectUpdateBrandingInput>;
