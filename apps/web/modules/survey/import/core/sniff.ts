import {
  type TArrayBudgetViolation,
  arrayBudgetInvalidParam,
  findArrayBudgetViolation,
  findRawArrayBudgetViolation,
} from "@/app/api/v3/lib/array-budget";
import type { TSurveyImportFileLimit } from "../types";
import {
  SurveyImportInputError,
  SurveyImportUnsupportedFileError,
  surveyImportFileUnreadable,
} from "./errors";
import { type TZipArchive, openZipArchive } from "./zip";

/**
 * An uploaded file, told apart by its content (ENG-6848) and read as far as telling it apart needs: a
 * JSON file parsed, an archive's directory checked, a CSV decoded. Each lane takes it from here.
 */
export type TSurveyImportFile =
  | { type: "formbricks"; json: Record<string, unknown> }
  | { type: "qsf"; json: Record<string, unknown> }
  | { type: "docx"; archive: TZipArchive }
  | { type: "xlsx"; archive: TZipArchive }
  | { type: "csv"; text: string };

/** A local file header, or the end record of an empty archive. */
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
];

/** The Compound File Binary header: Word 97–2003 (`.doc`) and Excel 97–2003 (`.xls`) files. */
const LEGACY_OFFICE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unsupported = () => new SurveyImportUnsupportedFileError("The import does not read this kind of file");

/** A `.docx` keeps its document under `word/`, a `.xlsx` its workbook under `xl/`. */
const sniffArchive = (bytes: Uint8Array): TSurveyImportFile => {
  const archive = openZipArchive(bytes);
  const isWord = archive.names.some((name) => name.startsWith("word/"));
  const isExcel = archive.names.some((name) => name.startsWith("xl/"));

  if (isWord && !isExcel) return { type: "docx", archive };
  if (isExcel && !isWord) return { type: "xlsx", archive };
  throw unsupported();
};

const BUDGET_LIMITS: Record<TArrayBudgetViolation["kind"], TSurveyImportFileLimit> = {
  array_too_long: "array_items",
  too_many_elements: "array_elements",
  too_deep: "nesting_depth",
};

const refuseOverBudget = (violation: TArrayBudgetViolation): SurveyImportInputError => {
  const { reason } = arrayBudgetInvalidParam(violation, "file");
  return new SurveyImportInputError(
    [
      {
        name: violation.path ? `file.${violation.path}` : "file",
        reason,
        code: "file_limit_exceeded",
        identifier: BUDGET_LIMITS[violation.kind],
      },
    ],
    "The file is past one of the import's limits."
  );
};

/**
 * A JSON file, held to the v3 request budget on its raw text before it is parsed — parsing is where a
 * hostile file costs memory: 15 MiB of `[[[…]]]` is ~470 MB of arrays (ENG-3653) — and again on the
 * parsed value, which drops a repeated key's earlier values. Then told apart by its shape: a Formbricks
 * file has its `formbricks` envelope, a Qualtrics export its `SurveyEntry` or `SurveyElements`. The
 * Qualtrics reader decides whether the rest of the export is one it can read.
 */
const sniffJson = (text: string): TSurveyImportFile => {
  const rawViolation = findRawArrayBudgetViolation(text);
  if (rawViolation) throw refuseOverBudget(rawViolation);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw surveyImportFileUnreadable("The file is not valid JSON");
  }

  const violation = findArrayBudgetViolation(json);
  if (violation) throw refuseOverBudget(violation);

  if (!isPlainObject(json)) throw unsupported();
  if (isPlainObject(json.formbricks)) return { type: "formbricks", json };
  if ("SurveyEntry" in json || "SurveyElements" in json) return { type: "qsf", json };
  throw unsupported();
};

/** Decodes UTF-8, dropping a byte-order mark, and refuses anything that is not valid UTF-8. */
const utf8 = new TextDecoder("utf-8", { fatal: true });

/**
 * Tell an uploaded file's type from its bytes, never from the name or the `Content-Type` the browser
 * sent (CODING_STANDARDS.md "File Uploads and Downloads"): the zip and Compound File signatures first,
 * then, for text, the JSON shape; any other text is a CSV.
 *
 * Throws `SurveyImportUnsupportedFileError` (415) for a kind of file the import does not read — a `.doc`
 * or `.xls` asked to be saved as `.docx` or `.xlsx` — `SurveyImportFileTooLargeError` (413) for an
 * archive past the zip limits, and `SurveyImportInputError` (422) for an empty or broken file or one
 * past the JSON budget.
 */
export const sniffSurveyImportFile = (bytes: Uint8Array): TSurveyImportFile => {
  if (bytes.length === 0) throw surveyImportFileUnreadable("The file is empty");

  if (ZIP_SIGNATURES.some((signature) => startsWith(bytes, signature))) return sniffArchive(bytes);

  if (startsWith(bytes, LEGACY_OFFICE_SIGNATURE)) {
    throw new SurveyImportUnsupportedFileError("Save the file as .docx or .xlsx", "legacy_office");
  }

  let text: string;
  try {
    text = utf8.decode(bytes);
  } catch {
    throw unsupported();
  }
  // Text never holds a NUL; binary formats nearly always do.
  if (text.includes("\u0000")) throw unsupported();

  const first = text.trimStart()[0];
  if (first === "{" || first === "[") return sniffJson(text);
  return { type: "csv", text };
};
