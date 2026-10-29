import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import type { TExportColumnGroup } from "@/lib/analysis-export/column-selection";
import { excludedForRequest, selectedGroups } from "@/lib/analysis-export/column-selection";
import {
  type TExcelSizeVerdict,
  type TExcelSizing,
  excelVerdictForEntries,
} from "@/lib/analysis-export/excel-size";
import {
  EXPORT_ADVANCED_OPTIONS,
  type TExportAdvancedOptionId,
  type TExportFormat,
  type TExportRequest,
  exportFileType,
  planExport,
} from "@/lib/analysis-export/export-request";
import type { TAnswerDisplay } from "@/lib/analysis-export/types";

/** What the Export modal's controls hold. */
export type TExportOptions = {
  format: TExportFormat;
  /** Display questions: what the column headers say. */
  questions: TAnswerDisplay;
  /** Display answers: what the cells hold. */
  display: TAnswerDisplay;
  spss: boolean;
  /** Compress into .zip, for a single CSV. Meaningless when the export is a zip anyway. */
  zip: boolean;
  advanced: TExportAdvancedOptionId[];
  /** Include columns: the groups switched OFF, so the defaults (everything on) send nothing. */
  excludedColumns: string[];
};

/** The Standard export: today's CSV. The modal always opens with these and remembers nothing. */
export const DEFAULT_EXPORT_OPTIONS: TExportOptions = {
  format: "csv",
  questions: "text",
  display: "text",
  spss: false,
  zip: false,
  advanced: [],
  excludedColumns: [],
};

/** The SPSS syntax file needs codes, so Text only is off the table while it is ticked. */
export const isTextOnlyAvailable = (options: TExportOptions): boolean => !options.spss;

/** The SPSS syntax file goes with CSV. */
export const isSpssAvailable = (options: TExportOptions): boolean => options.format === "csv";

/**
 * Whether Excel would be over the size cap for this selection, from the count request's `excel` verdict.
 * Unknown (still loading) and the Standard export (`null`) are not too large.
 */
export const isExcelTooLarge = (counts: { excel: { tooLarge: boolean } | null } | undefined): boolean =>
  counts?.excel?.tooLarge === true;

/** Excel is chosen and would be refused: the modal explains it and offers CSV instead of a download. */
export const isExcelBlocked = (
  options: TExportOptions,
  counts: { excel: { tooLarge: boolean } | null } | undefined
): boolean => options.format === "xlsx" && isExcelTooLarge(counts);

/**
 * The Excel verdict for the columns that are ticked. The server sizes the workbook with every column; the
 * modal narrows it as columns are switched off, so Excel comes back once the selection fits the cap.
 */
export const excelVerdictForSelection = (
  counts:
    | {
        columnGroups: TExportColumnGroup[];
        excel: TExcelSizeVerdict | null;
        excelSizing: TExcelSizing | null;
      }
    | undefined,
  excludedColumns: readonly string[]
): TExcelSizeVerdict | null => {
  if (!counts?.excel || !counts.excelSizing) return counts?.excel ?? null;
  const kept = selectedGroups(counts.columnGroups, excludedColumns).map((group) => group.id);
  return excelVerdictForEntries(counts.excel, counts.excelSizing, kept);
};

/**
 * Whether the counts of the current options are in. The request is only built from them: the column list
 * decides which columns the file drops and the Excel size decides whether it may be built, so a count still
 * on its way (or the previous one, shown while it loads) is no basis to start.
 */
export const isExportReady = (counts: { isSuccess: boolean; isPlaceholderData: boolean }): boolean =>
  counts.isSuccess && !counts.isPlaceholderData;

/** What switching the same choices to CSV downloads: a zip of CSV files, or one CSV file. */
export const excelAlternative = (options: TExportOptions): "csv" | "zip" => {
  const plan = planExport(toExportRequest(setFormat(options, "csv")));
  return plan.kind === "analysis" && plan.output === "zip" ? "zip" : "csv";
};

export const setFormat = (options: TExportOptions, format: TExportFormat): TExportOptions => ({
  ...options,
  format,
  spss: format === "csv" ? options.spss : false,
  zip: format === "csv" ? options.zip : false,
  advanced: options.advanced.filter((id) =>
    EXPORT_ADVANCED_OPTIONS.find((option) => option.id === id)?.appliesTo.includes(format)
  ),
});

export const setSpss = (options: TExportOptions, spss: boolean): TExportOptions => {
  const on = spss && isSpssAvailable(options);
  return {
    ...options,
    spss: on,
    questions: on && options.questions === "text" ? "codes" : options.questions,
    display: on && options.display === "text" ? "codes" : options.display,
  };
};

export const setDisplay = (options: TExportOptions, display: TAnswerDisplay): TExportOptions => {
  if (options.spss && display === "text") return { ...options, display: "codes" };
  return { ...options, display };
};

export const setQuestions = (options: TExportOptions, questions: TAnswerDisplay): TExportOptions => {
  if (options.spss && questions === "text") return { ...options, questions: "codes" };
  return { ...options, questions };
};

export const setZip = (options: TExportOptions, zip: boolean): TExportOptions => ({ ...options, zip });

export const setExcludedColumns = (options: TExportOptions, excludedColumns: string[]): TExportOptions => ({
  ...options,
  excludedColumns,
});

/** The extension of the file these options download, for the button: `.csv`, `.xlsx` or `.zip`. */
export const exportFileExtension = (options: TExportOptions): "csv" | "xlsx" | "zip" =>
  exportFileType(planExport(toExportRequest(options))).extension;

/** Compress into .zip is not a choice when the export has several files: it is a zip, always. */
export const isZipLocked = (options: TExportOptions): boolean =>
  exportFileExtension({ ...options, zip: false }) === "zip";

/** Excel is one file and has no zip to choose. */
export const isZipAvailable = (options: TExportOptions): boolean => options.format === "csv";

/**
 * What the row count can be read from while the file arrives: a CSV has one line per row, and the first
 * file of a zip is a CSV. Excel is built whole and the Standard export is built whole too: no rows to count.
 */
export const rowProgressOutput = (request: TExportRequest): "csv" | "zip" | null => {
  const plan = planExport(request);
  if (plan.kind === "standard" || plan.output === "xlsx") return null;
  return plan.output;
};

export type TCountLinePart =
  | { key: "filters" }
  | { key: "selection" }
  | { key: "low_quality_left_out"; count: number }
  | { key: "total"; count: number };

/**
 * The second line of the count box: the numbers behind "Include N responses". With nothing to explain (no
 * filter, no selection, no Low quality left out) there is no line.
 */
export const countLineParts = ({
  scope,
  lowQualityLeftOut,
  total,
}: {
  scope: { filter?: object; responseIds?: string[] };
  lowQualityLeftOut: number;
  total: number;
}): TCountLinePart[] => {
  const parts: TCountLinePart[] = [];
  if (scope.responseIds) parts.push({ key: "selection" });
  else if (Object.keys(scope.filter ?? {}).length > 0) parts.push({ key: "filters" });
  if (lowQualityLeftOut > 0) parts.push({ key: "low_quality_left_out", count: lowQualityLeftOut });
  if (parts.length > 0) parts.push({ key: "total", count: total });
  return parts;
};

export const toggleAdvanced = (
  options: TExportOptions,
  id: TExportAdvancedOptionId,
  on: boolean
): TExportOptions => {
  const others = options.advanced.filter((current) => current !== id);
  return { ...options, advanced: on ? [...others, id] : others };
};

/** The request to send. `responseIds` (a selection of rows) replaces the Responses filter. */
export const toExportRequest = (
  options: TExportOptions,
  scope: {
    filter?: TResponseFilterCriteria;
    responseIds?: string[];
    /** The Include columns list the options were made against. Left out: nothing is switched off. */
    columnGroups?: readonly TExportColumnGroup[];
  } = {}
): TExportRequest => {
  let filter: TResponseFilterCriteria | undefined;
  if (scope.responseIds) filter = { responseIds: scope.responseIds };
  else if (scope.filter) filter = scope.filter;
  return {
    format: options.format,
    questions: options.questions,
    display: options.display,
    spss: options.spss,
    zip: options.zip,
    advanced: options.advanced,
    excludedColumns: scope.columnGroups
      ? excludedForRequest(scope.columnGroups, options.excludedColumns)
      : [],
    ...(filter ? { filter } : {}),
  };
};
