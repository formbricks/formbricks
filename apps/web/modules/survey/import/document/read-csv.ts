import { CsvError, parse } from "csv-parse/sync";
import { surveyImportFileUnreadable } from "../core/errors";
import type { TSurveyImportTextEncoding } from "../core/sniff";
import {
  SURVEY_IMPORT_SHEET_MAX_CELL_CHARS,
  SURVEY_IMPORT_SHEET_MAX_COLUMNS,
  SURVEY_IMPORT_SHEET_MAX_ROWS,
} from "../limits";
import { documentLimitExceeded } from "./errors";
import { type TDocumentModel, buildGridModel, columnName } from "./model";

/**
 * The CSV reader of the document import (ENG-6852): a question list exported from a spreadsheet, read
 * with csv-parse like the feedback-source CSV import, as one sheet. The delimiter is told from the
 * file (German Excel writes `;`), and the list is held to the sheet limits.
 */

/** The delimiters a question list may use, in the order a tie between them is broken. */
const CSV_DELIMITERS = [",", ";", "\t", "|"] as const;

/** Records the delimiter is told from: enough for a header and a few questions. */
const SNIFF_RECORDS = 50;
/**
 * Characters the delimiter is told from, at most: the start of the list, cut at a line break. Each
 * candidate parses it once, so the sniff costs the same on a 15 MB list as on a short one.
 */
const SNIFF_CHARS = 64 * 1024;

/** The start of the text to sniff: up to `SNIFF_CHARS`, ending at a line break when it is cut. */
const sniffSample = (text: string): string => {
  if (text.length <= SNIFF_CHARS) return text;
  const cut = text.slice(0, SNIFF_CHARS);
  const lastBreak = cut.lastIndexOf("\n");
  return lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
};

type TCsvRecords = string[][];

/**
 * The most characters one record can hold within the sheet limits: every column's cell full. csv-parse
 * stops at a longer one instead of building it, which is what a 15 MB single field would cost.
 */
const MAX_RECORD_CHARS = SURVEY_IMPORT_SHEET_MAX_COLUMNS * (SURVEY_IMPORT_SHEET_MAX_CELL_CHARS + 1);

/**
 * `relaxQuotes`: a quote inside an unquoted field is text, as spreadsheet apps read it, since a
 * hand-written list has them (`1,Rate "the venue",Rating`); a quoted field parses the same either way.
 * The list is read relaxed. The delimiter is sniffed strictly first, because a stray quote under the
 * wrong delimiter is what rules that delimiter out.
 */
const parseRecords = (
  text: string,
  delimiter: string,
  { to, relaxQuotes }: { to?: number; relaxQuotes: boolean }
): TCsvRecords =>
  parse(text, {
    delimiter,
    bom: true,
    relax_column_count: true,
    relax_quotes: relaxQuotes,
    skip_empty_lines: false,
    max_record_size: MAX_RECORD_CHARS,
    ...(to === undefined ? {} : { to }),
  });

/**
 * How well `delimiter` splits the first records: the share of them with the most common field count,
 * when that count is more than one. A delimiter that never occurs leaves one field per record and
 * scores 0; one that occurs inside fields gives counts that differ from record to record.
 */
const scoreDelimiter = (
  text: string,
  delimiter: string,
  relaxQuotes: boolean
): { score: number; fields: number } => {
  let records: TCsvRecords;
  try {
    records = parseRecords(text, delimiter, { to: SNIFF_RECORDS, relaxQuotes }).filter((record) =>
      record.some((field) => field.trim() !== "")
    );
  } catch {
    return { score: 0, fields: 0 };
  }
  const counts = new Map<number, number>();
  for (const record of records) counts.set(record.length, (counts.get(record.length) ?? 0) + 1);
  let modal = { fields: 0, records: 0 };
  for (const [fields, count] of counts) {
    if (count > modal.records || (count === modal.records && fields > modal.fields)) {
      modal = { fields, records: count };
    }
  }
  return modal.fields > 1
    ? { score: modal.records / records.length, fields: modal.fields }
    : { score: 0, fields: modal.fields };
};

/** The delimiter that splits `sample` most consistently, or `null` when none splits it at all. */
const bestDelimiter = (sample: string, relaxQuotes: boolean): string | null => {
  let best: { delimiter: string | null; score: number; fields: number } = {
    delimiter: null,
    score: 0,
    fields: 0,
  };
  for (const delimiter of CSV_DELIMITERS) {
    const { score, fields } = scoreDelimiter(sample, delimiter, relaxQuotes);
    if (score > best.score || (score === best.score && score > 0 && fields > best.fields)) {
      best = { delimiter, score, fields };
    }
  }
  return best.delimiter;
};

/**
 * The delimiter that splits the list most consistently, a comma when none splits it at all. Sniffed
 * strictly first, so a quote that only parses under the wrong delimiter rules it out; relaxed only when
 * no delimiter parses strictly, as for a list with quotes inside its unquoted fields.
 */
export const sniffCsvDelimiter = (text: string): string => {
  const sample = sniffSample(text);
  return bestDelimiter(sample, false) ?? bestDelimiter(sample, true) ?? ",";
};

/** Hold the records to the sheet limits: columns with text, and characters per field. */
const checkRecords = (records: TCsvRecords): void => {
  records.forEach((record, rowIndex) => {
    let lastWithText = -1;
    record.forEach((field, columnIndex) => {
      if (field.length > SURVEY_IMPORT_SHEET_MAX_CELL_CHARS) {
        throw documentLimitExceeded(
          "cell_size",
          `file.${columnName(columnIndex)}${rowIndex + 1}`,
          `A field must not exceed ${SURVEY_IMPORT_SHEET_MAX_CELL_CHARS} characters`
        );
      }
      if (field.trim() !== "") lastWithText = columnIndex;
    });
    if (lastWithText >= SURVEY_IMPORT_SHEET_MAX_COLUMNS) {
      throw documentLimitExceeded(
        "columns",
        `file.R${rowIndex + 1}`,
        `A row must not have more than ${SURVEY_IMPORT_SHEET_MAX_COLUMNS} columns`
      );
    }
  });
};

/**
 * Read a CSV question list (text, and the encoding the upload was decoded as) into the document model. Throws
 * `SurveyImportInputError` — a 422 — for a list past the sheet limits (`document_limit_exceeded`), one
 * csv-parse cannot read, or one with no text (`file_unreadable`).
 */
export const readCsvDocument = (
  text: string,
  encoding: TSurveyImportTextEncoding = "utf-8"
): TDocumentModel => {
  const delimiter = sniffCsvDelimiter(text);

  let records: TCsvRecords;
  try {
    // One record past the limit is enough to know the list is past it.
    records = parseRecords(text, delimiter, { to: SURVEY_IMPORT_SHEET_MAX_ROWS + 1, relaxQuotes: true });
  } catch (error) {
    if (error instanceof CsvError && error.code === "CSV_MAX_RECORD_SIZE") {
      throw documentLimitExceeded(
        "cell_size",
        "file",
        `A row must not exceed ${MAX_RECORD_CHARS} characters, ${SURVEY_IMPORT_SHEET_MAX_CELL_CHARS} in one field`
      );
    }
    if (error instanceof CsvError) throw surveyImportFileUnreadable("The CSV file could not be parsed");
    throw error;
  }

  // Trailing empty records (a final line break) are not rows of the list.
  while (records.length > 0 && records.at(-1)?.every((field) => field.trim() === "")) records.pop();
  if (records.length > SURVEY_IMPORT_SHEET_MAX_ROWS) {
    throw documentLimitExceeded(
      "rows",
      "file",
      `The list must not have more than ${SURVEY_IMPORT_SHEET_MAX_ROWS} rows`
    );
  }
  checkRecords(records);

  const model = buildGridModel("csv", records, { encoding });
  if (model.lines.length === 0) throw surveyImportFileUnreadable("The CSV file has no text");
  return model;
};
