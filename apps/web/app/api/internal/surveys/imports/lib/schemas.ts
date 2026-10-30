import { z } from "zod";

/**
 * `POST /api/internal/surveys/imports`: the workspace to create in, and what the import preview returned
 * — the reviewed draft and, for a Formbricks file, the references it carries. Both are read again with
 * the create's own rules, which name each field they refuse, so here they only have to be objects.
 */
export const ZSurveyImportCreateBody = z.strictObject({
  workspaceId: z.cuid2(),
  survey: z.record(z.string(), z.unknown()),
  /** Only a Formbricks file has them; every other import's draft is the survey alone. */
  references: z.record(z.string(), z.unknown()).optional(),
});

export type TSurveyImportCreateBody = z.infer<typeof ZSurveyImportCreateBody>;
