import { z } from "zod";
import { checkEntriesMax, isPlainRecord } from "@/app/api/internal/lib/value-bounds";
import { SURVEY_IMPORT_MAX_DOCUMENT_ENTRIES } from "@/modules/survey/import/limits";

/**
 * The reviewed draft or its references, as the import preview returned them: an object of at most
 * `SURVEY_IMPORT_MAX_DOCUMENT_ENTRIES` entries, counted before the record schema copies it.
 */
export const ZImportedDocument = z
  .unknown()
  .superRefine((value, ctx) => {
    if (isPlainRecord(value)) checkEntriesMax(ctx, value, SURVEY_IMPORT_MAX_DOCUMENT_ENTRIES, []);
  })
  .pipe(z.record(z.string(), z.unknown()));

/**
 * `POST /api/internal/surveys/imports`: the workspace to create in, and what the import preview returned
 * — the reviewed draft and, for a Formbricks file, the references it carries. Both are read again with
 * the create's own rules, which name each field they refuse, so here they only have to be objects.
 */
export const ZSurveyImportCreateBody = z.strictObject({
  workspaceId: z.cuid2(),
  survey: ZImportedDocument,
  /** Only a Formbricks file has them; every other import's draft is the survey alone. */
  references: ZImportedDocument.optional(),
});

export type TSurveyImportCreateBody = z.infer<typeof ZSurveyImportCreateBody>;
