import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZSurveyPersonalLinksParams = z.object({ surveyId: ZId }).strict();

/** The segment whose contacts get a link, and how many days the links stay valid (none: they don't expire). */
export const ZSurveyPersonalLinksBody = z
  .object({
    segmentId: ZId,
    expirationDays: z.number().optional(),
  })
  .strict();

export type TSurveyPersonalLinksBody = z.infer<typeof ZSurveyPersonalLinksBody>;
