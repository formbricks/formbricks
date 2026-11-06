import type { TFunction } from "i18next";
import * as XLSX from "xlsx";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { SURVEY_EXPORT_FILE_EXTENSIONS } from "@/modules/survey/export/lib/formats";
import { getElementTypeLabel } from "@/modules/survey/lib/element-type-labels";
import {
  type TSurveyText,
  getSurveyTextFieldLabel,
  hasDefaultText,
  walkSurveyTexts,
} from "@/modules/survey/lib/survey-texts";
import { fitCell, toReadableText, toXmlSafeText } from "./cell-text";
import {
  EXCEL_EXPORT_FORMAT,
  EXCEL_EXPORT_KEY_HEADER,
  EXCEL_EXPORT_META_COLUMNS,
  EXCEL_EXPORT_META_FORMAT,
  EXCEL_EXPORT_META_HEADERS,
  EXCEL_EXPORT_META_LANGUAGES,
  EXCEL_EXPORT_META_LOCALE,
  EXCEL_EXPORT_META_SHEET,
} from "./format";
import { createLogicRenderer } from "./logic";

/**
 * The Excel export (ADR 0027): a survey as a sheet for reviewers and translators who don't use
 * Formbricks. One row per text the survey shows (each question, option, matrix row and column, and
 * the rest), one column per language, the question's id and type, and its block's logic in plain words.
 *
 * The sheet comes back through Import in the survey's own menu (ENG-6809), which updates the texts a
 * reviewer edited and adds the questions and options they added: every row carries its text's id-built
 * key in a hidden first column, and a very hidden sheet says how to read the columns back (`format.ts`).
 * The file names no survey: the import is aimed at one, and the keys match its texts or they don't.
 *
 * Every cell is a typed text cell in text format: nothing in it is ever read as a formula or a number,
 * and nothing is prefixed with `'`, which xlsx would keep as part of the text.
 */

export const EXCEL_EXPORT_EXTENSION = SURVEY_EXPORT_FILE_EXTENSIONS.xlsx;
export const EXCEL_EXPORT_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Excel caps sheet names at 31 characters and refuses []:*?/\ in them.
const SHEET_NAME_FORBIDDEN = /[[\]:*?/\\]/g;
const SHEET_NAME_MAX_CHARS = 31;

// Column widths in characters: key (hidden), Question ID, Type, each language, Logic.
const WIDTH_ID = 20;
const WIDTH_TYPE = 24;
const WIDTH_LANGUAGE = 50;
const WIDTH_LOGIC = 60;

/**
 * One column of texts. `code` is the language's code, which the meta sheet records, or `default` for a
 * survey without languages; `textKey` is where the survey keeps the column's text (`default` for the
 * default language, as stored).
 */
type TLanguageColumn = { code: string; textKey: string; header: string };

type TTypedTextCell = { t: "s"; v: string; z: "@" };

/** A text as its cell holds it: without what xlsx cannot hold, and cut to fit. Idempotent. */
const toCellText = (text: string, truncatedSuffix: string): string =>
  fitCell(toXmlSafeText(text), truncatedSuffix);

/**
 * One stored text in one language as the export writes its cell: readable, then fitted to the cell. The
 * import computes the survey's current cells with it too, to tell what changed in Formbricks since the
 * export, so both read a text the same way.
 */
export const toExportedCellText = ({
  text,
  textKey,
  survey,
  truncatedSuffix,
}: {
  text: TSurveyText;
  textKey: string;
  survey: TSurvey;
  truncatedSuffix: string;
}): string => {
  const stored = text.value?.[textKey] ?? "";
  if (!stored) return "";
  return toCellText(
    toReadableText({ text: stored, isRichText: text.isRichText, survey, languageCode: textKey }),
    truncatedSuffix
  );
};

const textCell = (text: string, truncatedSuffix: string): TTypedTextCell => ({
  t: "s",
  v: toCellText(text, truncatedSuffix),
  z: "@",
});

/** A sheet of typed text cells only: never a formula, a number or a date, whatever the text looks like. */
const toTextSheet = (rows: string[][], truncatedSuffix: string): XLSX.WorkSheet => {
  const sheet: XLSX.WorkSheet = {};
  let lastColumn = 0;
  rows.forEach((row, rowIndex) => {
    row.forEach((text, columnIndex) => {
      sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] = textCell(text, truncatedSuffix);
    });
    lastColumn = Math.max(lastColumn, row.length - 1);
  });
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(rows.length - 1, 0), c: lastColumn },
  });
  return sheet;
};

const getLanguageColumns = (survey: TSurvey, t: TFunction, locale: string): TLanguageColumn[] => {
  if (survey.languages.length === 0) {
    return [{ code: "default", textKey: "default", header: t("workspace.surveys.export.excel.text_column") }];
  }

  // The default language first, then the others by code. A survey stores no order for its languages
  // (`SurveyLanguage` has no position), so they come back in whatever order the database returns, and
  // only a sort of our own keeps the columns where they were from one export to the next.
  const languages = [...survey.languages].sort(
    (a, b) => Number(b.default) - Number(a.default) || a.language.code.localeCompare(b.language.code, "en")
  );
  return languages.map(({ language, default: isDefault }) => {
    const params = {
      name: getLanguageLabel(language.code, locale) ?? language.alias ?? language.code,
      code: language.code,
    };
    return {
      code: language.code,
      textKey: isDefault ? "default" : language.code,
      header: isDefault
        ? t("workspace.surveys.export.excel.language_column_default", params)
        : t("workspace.surveys.export.excel.language_column", params),
    };
  });
};

const isHeadline = (text: TSurveyText): boolean =>
  text.field.kind === "property" && text.field.property === "headline";

/** The Question ID and Type cells of one row. */
const describeRow = (text: TSurveyText, t: TFunction, survey: TSurvey): [string, string] => {
  const field = getSurveyTextFieldLabel(text.field, t);
  switch (text.owner.kind) {
    case "element":
      return [
        text.owner.element.id,
        isHeadline(text) ? getElementTypeLabel(text.owner.element.type, t) : field,
      ];
    case "welcomeCard":
      return ["", t("workspace.surveys.export.excel.welcome_card_field", { field })];
    case "block":
      return [
        "",
        t("workspace.surveys.export.excel.block_field", {
          block: survey.blocks[text.owner.blockIndex]?.name ?? "",
          field,
        }),
      ];
    case "ending":
      return [
        text.owner.endingId,
        t("workspace.surveys.export.excel.ending_field", { n: text.owner.endingIndex + 1, field }),
      ];
  }
};

/**
 * The row that carries each block's logic: the block's first question row, which is its first question's
 * headline. Keyed by block id, valued by row index into `texts`.
 */
const getLogicRows = (texts: TSurveyText[]): Map<string, number> => {
  const rows = new Map<string, number>();
  texts.forEach((text, index) => {
    if (text.owner.kind === "element" && !rows.has(text.owner.blockId)) rows.set(text.owner.blockId, index);
  });
  return rows;
};

/**
 * The survey as an xlsx workbook: the visible texts sheet first, then the very hidden meta sheet.
 * `t` and `locale` are the exporting user's, for headers, types and the Logic column; the texts
 * themselves are the survey's own, in each of its languages.
 */
export const writeExcelExport = ({
  survey,
  t,
  locale,
}: {
  survey: TSurvey;
  t: TFunction;
  locale: string;
}): Uint8Array<ArrayBuffer> => {
  const truncatedSuffix = t("workspace.surveys.export.excel.truncated");
  const languageColumns = getLanguageColumns(survey, t, locale);
  const renderLogic = createLogicRenderer({ survey, t, locale });

  const texts = walkSurveyTexts(survey).filter((text) => text.value !== undefined && hasDefaultText(text));
  const blocksById = new Map(survey.blocks.map((block) => [block.id, block]));
  const logicRows = new Map(
    [...getLogicRows(texts)].map(([blockId, rowIndex]) => {
      const block = blocksById.get(blockId);
      return [rowIndex, block ? renderLogic(block) : ""];
    })
  );

  const questionIdHeader = t("workspace.surveys.export.excel.question_id_column");
  const typeHeader = t("workspace.surveys.export.excel.type_column");
  const header = [
    EXCEL_EXPORT_KEY_HEADER,
    questionIdHeader,
    typeHeader,
    ...languageColumns.map((column) => column.header),
    t("workspace.surveys.export.excel.logic_column"),
  ];

  const languageCells = texts.map((text) =>
    languageColumns.map(({ textKey }) => toExportedCellText({ text, textKey, survey, truncatedSuffix }))
  );

  const rows = texts.map((text, index) => {
    const [questionId, type] = describeRow(text, t, survey);
    return [text.key, questionId, type, ...languageCells[index], logicRows.get(index) ?? ""];
  });

  const sheet = toTextSheet([header, ...rows], truncatedSuffix);
  sheet["!cols"] = [
    { hidden: true },
    { wch: WIDTH_ID },
    { wch: WIDTH_TYPE },
    ...languageColumns.map(() => ({ wch: WIDTH_LANGUAGE })),
    { wch: WIDTH_LOGIC },
  ];

  const meta = toTextSheet(
    [
      [EXCEL_EXPORT_META_FORMAT, String(EXCEL_EXPORT_FORMAT)],
      [EXCEL_EXPORT_META_LANGUAGES, ...languageColumns.map((column) => column.code)],
      [EXCEL_EXPORT_META_HEADERS, ...languageColumns.map((column) => column.header)],
      [EXCEL_EXPORT_META_COLUMNS, questionIdHeader, typeHeader],
      [EXCEL_EXPORT_META_LOCALE, locale],
    ],
    truncatedSuffix
  );

  const sheetName =
    t("workspace.surveys.export.excel.sheet_name")
      .replaceAll(SHEET_NAME_FORBIDDEN, "")
      .slice(0, SHEET_NAME_MAX_CHARS) || "Survey";

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.utils.book_append_sheet(workbook, meta, EXCEL_EXPORT_META_SHEET);
  // 2 is "very hidden": not listed under Unhide, only reachable from the VBA editor or by code.
  workbook.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 2 }] };

  // A shared string table makes each cell a plain string (`t="s"`), as Excel writes them; without it SheetJS
  // writes `t="str"`, the type of a formula's cached result.
  return new Uint8Array(
    XLSX.write(workbook, { type: "array", bookType: "xlsx", bookSST: true, compression: true })
  );
};
