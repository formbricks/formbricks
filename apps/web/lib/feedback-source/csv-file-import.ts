import "server-only";
import { parse } from "csv-parse/sync";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  CSV_AT_LEAST_ONE_ROW_ERROR_CODE,
  CSV_EMPTY_COLUMN_HEADERS_ERROR_CODE,
  CSV_FILES_ONLY_ERROR_CODE,
  CSV_FILE_TOO_LARGE_ERROR_CODE,
  CSV_INCONSISTENT_COLUMNS_ERROR_CODE,
  CSV_MAX_RECORDS_ERROR_CODE,
  CSV_PARSE_ERROR_CODE,
  MAX_CSV_VALUES,
} from "@/modules/ee/unify-feedback/sources/types";
import type { TImportResult } from "./import";

export type TCsvImportErrorCode =
  | typeof CSV_AT_LEAST_ONE_ROW_ERROR_CODE
  | typeof CSV_EMPTY_COLUMN_HEADERS_ERROR_CODE
  | typeof CSV_FILE_TOO_LARGE_ERROR_CODE
  | typeof CSV_FILES_ONLY_ERROR_CODE
  | typeof CSV_INCONSISTENT_COLUMNS_ERROR_CODE
  | typeof CSV_MAX_RECORDS_ERROR_CODE
  | typeof CSV_PARSE_ERROR_CODE;

export class CsvImportValidationError extends Error {
  readonly code: TCsvImportErrorCode;
  readonly row?: number;
  readonly max?: number;

  constructor(code: TCsvImportErrorCode, options: { row?: number; max?: number } = {}) {
    super(code);
    this.name = "CsvImportValidationError";
    this.code = code;
    this.row = options.row;
    this.max = options.max;
  }
}

const isCsvFile = (file: File): boolean => {
  const hasCsvExtension = file.name.toLowerCase().endsWith(".csv");
  const hasCsvMimeType = file.type === "" || file.type === "text/csv" || file.type.includes("csv");

  return hasCsvExtension && hasCsvMimeType;
};

const assertValidCsvFile = (file: File): void => {
  if (!isCsvFile(file)) {
    throw new CsvImportValidationError(CSV_FILES_ONLY_ERROR_CODE);
  }

  if (file.size > MAX_CSV_VALUES.FILE_SIZE) {
    throw new CsvImportValidationError(CSV_FILE_TOO_LARGE_ERROR_CODE);
  }
};

const assertValidCsvRows = (rows: Record<string, string>[]): void => {
  if (rows.length === 0) {
    throw new CsvImportValidationError(CSV_AT_LEAST_ONE_ROW_ERROR_CODE);
  }

  if (rows.length > MAX_CSV_VALUES.RECORDS) {
    throw new CsvImportValidationError(CSV_MAX_RECORDS_ERROR_CODE, { max: MAX_CSV_VALUES.RECORDS });
  }

  const localeSort = (a: string, b: string) => a.localeCompare(b);
  const firstRowKeys = Object.keys(rows[0]);
  const firstRowKeysFingerprint = firstRowKeys.sort(localeSort).join(",");

  if (firstRowKeys.some((key) => key.trim() === "")) {
    throw new CsvImportValidationError(CSV_EMPTY_COLUMN_HEADERS_ERROR_CODE);
  }

  for (let i = 1; i < rows.length; i++) {
    const rowKeysFingerprint = Object.keys(rows[i]).sort(localeSort).join(",");
    if (rowKeysFingerprint !== firstRowKeysFingerprint) {
      throw new CsvImportValidationError(CSV_INCONSISTENT_COLUMNS_ERROR_CODE, { row: i + 1 });
    }
  }
};

export const parseCsvImportFile = async (file: File): Promise<Record<string, string>[]> => {
  assertValidCsvFile(file);

  let rows: Record<string, string>[];
  try {
    rows = parse(await file.text(), { columns: true, relax_column_count: true, skip_empty_lines: true });
  } catch {
    throw new CsvImportValidationError(CSV_PARSE_ERROR_CODE);
  }

  assertValidCsvRows(rows);

  return rows;
};

export const importCsvFile = async ({
  feedbackSourceId,
  workspaceId,
  file,
}: {
  feedbackSourceId: string;
  workspaceId: string;
  file: File;
}): Promise<TImportResult> => {
  const csvRows = await parseCsvImportFile(file);
  const [{ importCsvData }, { getFeedbackSourceWithMappingsById, updateFeedbackSource }] = await Promise.all([
    import("./csv-import"),
    import("./service"),
  ]);
  const feedbackSource = await getFeedbackSourceWithMappingsById(feedbackSourceId, workspaceId);

  if (!feedbackSource) {
    throw new ResourceNotFoundError("FeedbackSource", feedbackSourceId);
  }

  const result = await importCsvData(feedbackSource, csvRows);

  if (result.successes > 0) {
    await updateFeedbackSource(feedbackSourceId, workspaceId, {
      lastSyncAt: new Date(),
    });
  }

  return result;
};
