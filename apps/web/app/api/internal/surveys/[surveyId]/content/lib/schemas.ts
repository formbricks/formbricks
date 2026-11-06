import { z } from "zod";
import { ZV3ExpectedUpdatedAt } from "@/app/api/v3/surveys/schemas";

/**
 * `PUT /api/internal/surveys/{surveyId}/content` (ENG-6851): what the import preview returned for a
 * Match — the reviewed draft and the file's references — with the `updatedAt` the Update is made against
 * and the triggers choice. The survey and references are read again with a Formbricks file's own rules,
 * which name each field they refuse, so here they only have to be objects.
 */
export const ZSurveyContentUpdateBody = z.strictObject({
  survey: z.record(z.string(), z.unknown()),
  references: z.record(z.string(), z.unknown()),
  updatedAt: ZV3ExpectedUpdatedAt,
  triggers: z.enum(["file", "keep"]),
});

export type TSurveyContentUpdateBody = z.infer<typeof ZSurveyContentUpdateBody>;

export const ZSurveyContentUpdateParams = z.object({ surveyId: z.cuid2() });
