import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZSurveySingleUseSettingsParams = z.object({ surveyId: ZId }).strict();

/** Whether the survey's link is single-use, and whether its single-use ids are encrypted. */
export const ZSurveySingleUseSettingsBody = z
  .object({
    enabled: z.boolean(),
    isEncrypted: z.boolean(),
  })
  .strict();

export type TSurveySingleUseSettingsBody = z.infer<typeof ZSurveySingleUseSettingsBody>;
