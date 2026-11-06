import { z } from "zod";
import { toDisplayFileName } from "@/lib/utils/display-file-name";

/** The longest file name the import shows; past it the upload is refused rather than cut. */
const FILE_NAME_MAX_CHARS = 255;
/** The longest name it cleans: room for marks the cleaning drops, without cleaning a name of any size. */
const FILE_NAME_MAX_RAW_CHARS = FILE_NAME_MAX_CHARS * 4;

/**
 * The name the report shows for an uploaded file: without control characters or bidirectional marks, so
 * `invoice\u202Egpj.exe` cannot show as `invoiceexe.jpg`, and with its whitespace collapsed.
 */
export const getSurveyImportFileName = (file: File): string => toDisplayFileName(file.name);

/**
 * `POST /api/internal/surveys/import/stream`, a `multipart/form-data` body (ENG-6848): the workspace to
 * import into and exactly one file part. Every file type is sent the same way; the route tells them
 * apart from the bytes, never from the part's `Content-Type` or the file name.
 *
 * The name is display text only — it becomes the report's `source.fileName` — and nothing is stored. A
 * name with nothing readable left once cleaned is refused like an empty one.
 */
const ZSurveyImportFile = z.instanceof(File, { message: "Expected exactly one file" }).refine(
  (file) => {
    if (file.name.length > FILE_NAME_MAX_RAW_CHARS) return false;
    const name = getSurveyImportFileName(file);
    return name.length > 0 && name.length <= FILE_NAME_MAX_CHARS;
  },
  { message: `The file name must be 1 to ${FILE_NAME_MAX_CHARS} characters` }
);

export const ZSurveyImportStreamForm = z.strictObject({
  workspaceId: z.cuid2(),
  file: ZSurveyImportFile,
});

export type TSurveyImportStreamForm = z.infer<typeof ZSurveyImportStreamForm>;

/**
 * `POST /api/internal/surveys/{surveyId}/import/stream` (ENG-6809): exactly one file part, imported into
 * the survey the path names. The same file rules as the workspace's import.
 */
export const ZSurveyImportIntoSurveyForm = z.strictObject({ file: ZSurveyImportFile });

export const ZSurveyImportIntoSurveyParams = z.strictObject({ surveyId: z.cuid2() });
