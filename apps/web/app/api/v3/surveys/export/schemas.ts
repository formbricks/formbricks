import { z } from "zod";
import { ZActionClass } from "@formbricks/types/action-classes";
import { createZV3TypedSurveyDocumentSchema } from "../schemas";

/**
 * Portable survey export ("`.formbricks.json`"). Format 1 is the v3 survey document in a thin envelope:
 * export metadata, the document itself (as `GET /api/v3/surveys/{id}` serializes it, minus the
 * instance-bound fields), and the definitions of the action classes the document's triggers point at.
 *
 * Nothing the v3 document omits travels (D1): styling, follow-ups, quotas, survey settings, slug,
 * custom scripts, targeting. Every level is `.strict()` so a hand-edited file with an `extensions`
 * block is rejected with a path instead of being silently ignored.
 */
export const SURVEY_EXPORT_FORMAT = 1 as const;

export const ZSurveyExportActionClassReference = ZActionClass.pick({
  id: true,
  name: true,
  key: true,
  type: true,
  noCodeConfig: true,
  description: true,
}).strict();

export type TSurveyExportActionClassReference = z.infer<typeof ZSurveyExportActionClassReference>;

export const ZSurveyExportSource = z
  .object({
    url: z.url(),
    workspaceId: z.cuid2(),
    surveyId: z.cuid2(),
  })
  .strict();

export const ZSurveyExportMetadata = z
  .object({
    exportFormat: z.literal(SURVEY_EXPORT_FORMAT),
    exportedAt: z.iso.datetime(),
    appVersion: z.string().trim().min(1),
    source: ZSurveyExportSource,
  })
  .strict();

export type TSurveyExportMetadata = z.infer<typeof ZSurveyExportMetadata>;

export const ZSurveyExportReferences = z
  .object({
    actionClasses: z.array(ZSurveyExportActionClassReference),
  })
  .strict();

export type TSurveyExportReferences = z.infer<typeof ZSurveyExportReferences>;

/**
 * The envelope as a file: three top-level keys, nothing else. `survey` is parsed with the same rules
 * as a create body (public locale maps, strict unknown-field rejection, language declarations), so a
 * parsed envelope's `survey` is a `TV3TypedSurveyDocument` — the importer only has to add `workspaceId`.
 */
export const ZSurveyExportEnvelope = z
  .object({
    formbricks: ZSurveyExportMetadata,
    survey: createZV3TypedSurveyDocumentSchema(),
    references: ZSurveyExportReferences,
  })
  .strict();

export type TSurveyExportEnvelope = z.infer<typeof ZSurveyExportEnvelope>;

/**
 * A file that claims a newer format than this instance understands. Checked before the full parse so
 * the message can say "newer instance" instead of "expected literal 1".
 */
export const ZSurveyExportFormatProbe = z.object({
  formbricks: z.object({ exportFormat: z.number().int() }).loose(),
});

export function getSurveyExportFormat(value: unknown): number | null {
  const probe = ZSurveyExportFormatProbe.safeParse(value);
  return probe.success ? probe.data.formbricks.exportFormat : null;
}
