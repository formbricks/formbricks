import { SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";

/** A Formbricks file: `<name>.formbricks.json`, or any `.json` an AI assistant saved it as. */
export const FORMBRICKS_FILE_INPUT_EXTENSION = ".json";

export const QSF_FILE_EXTENSION = ".qsf";

/**
 * The files Formbricks AI reads: a Qualtrics export, and a questionnaire from Word (ENG-6853), Excel,
 * CSV (ENG-6852) or Markdown, which the server reads as text and tells apart from a CSV by its content.
 */
export const AI_FILE_EXTENSIONS: readonly string[] = [QSF_FILE_EXTENSION, ".docx", ".xlsx", ".csv", ".md"];

/**
 * The files an import into a survey's own menu takes (ENG-6809): a Formbricks file, or the survey's
 * Excel export. Neither is read by AI.
 */
export const INTO_SURVEY_FILE_EXTENSIONS: readonly string[] = [FORMBRICKS_FILE_INPUT_EXTENSION, ".xlsx"];

/** Why the browser refused a file before uploading it. */
export type TSurveyImportFileError =
  | "file_wrong_extension"
  | "file_wrong_extension_into_survey"
  | "file_needs_ai"
  | "file_empty"
  | "file_too_large";

/**
 * The extensions the drop zone offers: a Formbricks file always, the files Formbricks AI reads only with
 * it (ENG-6850).
 */
export const getSurveyImportFileExtensions = (isAIAvailable: boolean): string[] =>
  isAIAvailable
    ? [FORMBRICKS_FILE_INPUT_EXTENSION, ...AI_FILE_EXTENSIONS]
    : [FORMBRICKS_FILE_INPUT_EXTENSION];

/**
 * What the dialog refuses from the file's name and size alone, before uploading it. The name is only a
 * hint for the user's sake: the server tells the type from the bytes and answers anything else itself.
 * Without Formbricks AI, a file it would read is refused as one that needs it.
 */
export const checkSurveyImportFile = (
  file: { name: string; size: number },
  { isAIAvailable, intoSurvey = false }: { isAIAvailable: boolean; intoSurvey?: boolean }
): TSurveyImportFileError | null => {
  const name = file.name.toLowerCase();
  if (intoSurvey) {
    if (!INTO_SURVEY_FILE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      return "file_wrong_extension_into_survey";
    }
  } else if (!isAIAvailable && AI_FILE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "file_needs_ai";
  }
  if (
    !intoSurvey &&
    !getSurveyImportFileExtensions(isAIAvailable).some((extension) => name.endsWith(extension))
  ) {
    return "file_wrong_extension";
  }
  if (file.size === 0) return "file_empty";
  if (file.size > SURVEY_IMPORT_MAX_FILE_BYTES) return "file_too_large";
  return null;
};
