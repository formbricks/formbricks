/** The dialog's own cap, under the route's 15.5 MiB body limit so the JSON envelope always fits. */
export const QSF_IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const QSF_FILE_EXTENSION = ".qsf";

/** Why the browser refused a file before uploading it. */
export type TQsfFileError =
  | "qsf_wrong_extension"
  | "qsf_empty"
  | "qsf_too_large"
  | "qsf_not_json"
  | "qsf_not_object"
  | "qsf_unreadable";

export type TQsfFileReadResult =
  | { ok: true; fileName: string; qsf: Record<string, unknown> }
  | { ok: false; error: TQsfFileError };

/** What can be refused from the file's name and size alone, before reading it. */
export const checkQsfFile = (file: { name: string; size: number }): TQsfFileError | null => {
  if (!file.name.toLowerCase().endsWith(QSF_FILE_EXTENSION)) return "qsf_wrong_extension";
  if (file.size === 0) return "qsf_empty";
  if (file.size > QSF_IMPORT_MAX_FILE_BYTES) return "qsf_too_large";
  return null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Read a dropped .qsf into the object the import route expects. The route takes the parsed file, not
 * its text, so a file that isn't a JSON object is refused here instead of being uploaded to fail.
 */
export const readQsfFile = async (file: File): Promise<TQsfFileReadResult> => {
  const refused = checkQsfFile(file);
  if (refused) return { ok: false, error: refused };

  // A read can still fail after the file was chosen, e.g. when it was moved or its access changed.
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "qsf_unreadable" };
  }
  // `File.text()` decodes as UTF-8 and drops a leading BOM; the slice covers a file read some other way.
  const json = text.startsWith("﻿") ? text.slice(1) : text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "qsf_not_json" };
  }

  return isPlainObject(parsed)
    ? { ok: true, fileName: file.name, qsf: parsed }
    : { ok: false, error: "qsf_not_object" };
};
