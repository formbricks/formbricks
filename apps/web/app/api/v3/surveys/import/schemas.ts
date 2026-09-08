import { z } from "zod";
import { ZSurveyExportReferences } from "../export/schemas";

const ZImportObject = z.record(z.string(), z.unknown());

export const ZV3SurveyImportOptions = z
  .object({
    /** Overrides the survey name (the review step's "Survey name" input). */
    name: z.string().trim().min(1).max(200).optional(),
    /** Resolve and validate only. Nothing is written, no action classes or languages are created. */
    dryRun: z.boolean().optional(),
  })
  .strict();

/**
 * Exactly one of `export` (a `.formbricks.json` envelope) or `document` (a raw v3 survey document).
 * Both are parsed by the lossless lane, not here, so a file with a stray `extensions` block or a
 * hand-edited `slug` is reported instead of rejected at the door. `references` travels with a
 * `document` when the dialog sends back a resolved draft whose triggers still point at the source
 * workspace's action classes.
 */
export const ZV3SurveyImportBody = z
  .object({
    workspaceId: z.cuid2(),
    export: ZImportObject.optional(),
    document: ZImportObject.optional(),
    references: ZSurveyExportReferences.optional(),
    options: ZV3SurveyImportOptions.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const provided = [body.export !== undefined, body.document !== undefined].filter(Boolean).length;
    if (provided !== 1) {
      ctx.addIssue({
        code: "custom",
        path: provided === 0 ? ["document"] : ["export"],
        message: "Provide exactly one of 'export' or 'document'",
      });
    }
  });

export type TV3SurveyImportBody = z.infer<typeof ZV3SurveyImportBody>;
