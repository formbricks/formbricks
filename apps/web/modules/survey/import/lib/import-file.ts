import { SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";

/** A Formbricks file: `<name>.formbricks.json`, or any `.json` an AI assistant saved it as. */
export const FORMBRICKS_FILE_INPUT_EXTENSION = ".json";

/**
 * A survey's Excel export, or any other workbook. Without Formbricks AI only an Excel export is taken
 * (ENG-6809), which the dialog tells from its content before uploading (`isExcelExportFile`).
 */
export const EXCEL_FILE_EXTENSION = ".xlsx";

export const QSF_FILE_EXTENSION = ".qsf";

/**
 * The files Formbricks AI reads: a Qualtrics export, and a questionnaire from Word (ENG-6853), Excel,
 * CSV (ENG-6852) or Markdown, which the server reads as text and tells apart from a CSV by its content.
 */
export const AI_FILE_EXTENSIONS: readonly string[] = [
  QSF_FILE_EXTENSION,
  ".docx",
  EXCEL_FILE_EXTENSION,
  ".csv",
  ".md",
];

/** The files the import takes without Formbricks AI: a Formbricks file, and a survey's Excel export. */
const NO_AI_FILE_EXTENSIONS: readonly string[] = [FORMBRICKS_FILE_INPUT_EXTENSION, EXCEL_FILE_EXTENSION];

/** Why the browser refused a file before uploading it. */
export type TSurveyImportFileError =
  | "file_wrong_extension"
  | "file_needs_ai"
  | "file_empty"
  | "file_too_large";

/**
 * The extensions the drop zone offers: a Formbricks file and an Excel file always, the other files
 * Formbricks AI reads only with it (ENG-6850, ENG-6809).
 */
export const getSurveyImportFileExtensions = (isAIAvailable: boolean): string[] =>
  isAIAvailable ? [FORMBRICKS_FILE_INPUT_EXTENSION, ...AI_FILE_EXTENSIONS] : [...NO_AI_FILE_EXTENSIONS];

/**
 * What the dialog refuses from the file's name and size alone, before uploading it. The name is only a
 * hint for the user's sake: the server tells the type from the bytes and answers anything else itself.
 * Without Formbricks AI, a file only it reads is refused as one that needs it; an Excel file passes here,
 * and `needsExcelExportCheck` says the dialog must still tell it is an Excel export.
 */
export const checkSurveyImportFile = (
  file: { name: string; size: number },
  { isAIAvailable }: { isAIAvailable: boolean }
): TSurveyImportFileError | null => {
  const name = file.name.toLowerCase();
  const needsAI =
    AI_FILE_EXTENSIONS.some((extension) => name.endsWith(extension)) &&
    !NO_AI_FILE_EXTENSIONS.some((extension) => name.endsWith(extension));
  if (!isAIAvailable && needsAI) {
    return "file_needs_ai";
  }
  if (!getSurveyImportFileExtensions(isAIAvailable).some((extension) => name.endsWith(extension))) {
    return "file_wrong_extension";
  }
  if (file.size === 0) return "file_empty";
  if (file.size > SURVEY_IMPORT_MAX_FILE_BYTES) return "file_too_large";
  return null;
};

/**
 * Whether the dialog must read the file before uploading it: without Formbricks AI, an Excel file goes up
 * only when it is laid out as an Excel export (`isExcelExportFile`), and is refused as needing AI otherwise.
 */
export const needsExcelExportCheck = (
  file: { name: string },
  { isAIAvailable }: { isAIAvailable: boolean }
): boolean => !isAIAvailable && file.name.toLowerCase().endsWith(EXCEL_FILE_EXTENSION);
