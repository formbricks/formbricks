import { SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";

export const QSF_FILE_EXTENSION = ".qsf";

/** Why the browser refused a file before uploading it. */
export type TQsfFileError = "file_wrong_extension" | "file_empty" | "file_too_large";

/**
 * What the dialog refuses from the file's name and size alone, before uploading it. The name is only a
 * hint for the user's sake: the server tells the type from the bytes and answers anything else itself.
 */
export const checkQsfFile = (file: { name: string; size: number }): TQsfFileError | null => {
  if (!file.name.toLowerCase().endsWith(QSF_FILE_EXTENSION)) return "file_wrong_extension";
  if (file.size === 0) return "file_empty";
  if (file.size > SURVEY_IMPORT_MAX_FILE_BYTES) return "file_too_large";
  return null;
};
