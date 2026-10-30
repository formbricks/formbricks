import { z } from "zod";

/**
 * `POST /api/internal/surveys/imports`: the workspace to create in, and what the import preview returned
 * — the reviewed draft and the references the file carries. Both are read again with a Formbricks
 * file's own rules, which name each field they refuse, so here they only have to be objects.
 */
export const ZSurveyImportCreateBody = z.strictObject({
  workspaceId: z.cuid2(),
  survey: z.record(z.string(), z.unknown()),
  references: z.record(z.string(), z.unknown()),
});

export type TSurveyImportCreateBody = z.infer<typeof ZSurveyImportCreateBody>;
