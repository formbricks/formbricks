import { z } from "zod";

/** The longest file name the import shows; past it the upload is refused rather than cut. */
const FILE_NAME_MAX_CHARS = 255;

/**
 * `POST /api/internal/surveys/import/stream`, a `multipart/form-data` body (ENG-6848): the workspace to
 * import into and exactly one file part. Every file type is sent the same way; the route tells them
 * apart from the bytes, never from the part's `Content-Type` or the file name.
 *
 * The name is display text only — it becomes the report's `source.fileName` — and nothing is stored.
 */
export const ZSurveyImportStreamForm = z.strictObject({
  workspaceId: z.cuid2(),
  file: z.instanceof(File, { message: "Expected exactly one file" }).refine(
    (file) => {
      const name = file.name.trim();
      return name.length > 0 && name.length <= FILE_NAME_MAX_CHARS;
    },
    { message: `The file name must be 1 to ${FILE_NAME_MAX_CHARS} characters` }
  ),
});

export type TSurveyImportStreamForm = z.infer<typeof ZSurveyImportStreamForm>;
