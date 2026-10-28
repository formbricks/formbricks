import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import {
  EXPORT_ADVANCED_OPTIONS,
  type TExportAdvancedOptionId,
  type TExportFormat,
  type TExportRequest,
  planExport,
} from "@/lib/analysis-export/export-request";
import type { TAnswerDisplay } from "@/lib/analysis-export/types";

/** What the Export modal's controls hold. */
export type TExportOptions = {
  format: TExportFormat;
  display: TAnswerDisplay;
  spss: boolean;
  advanced: TExportAdvancedOptionId[];
};

/** The Standard export: today's CSV. The modal always opens with these and remembers nothing. */
export const DEFAULT_EXPORT_OPTIONS: TExportOptions = {
  format: "csv",
  display: "text",
  spss: false,
  advanced: [],
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

/** What switching the same choices to CSV downloads: a zip of CSV files, or one CSV file. */
export const excelAlternative = (options: TExportOptions): "csv" | "zip" => {
  const plan = planExport(toExportRequest(setFormat(options, "csv")));
  return plan.kind === "analysis" && plan.output === "zip" ? "zip" : "csv";
};

export const setFormat = (options: TExportOptions, format: TExportFormat): TExportOptions => ({
  ...options,
  format,
  spss: format === "csv" ? options.spss : false,
  advanced: options.advanced.filter((id) =>
    EXPORT_ADVANCED_OPTIONS.find((option) => option.id === id)?.appliesTo.includes(format)
  ),
});

export const setSpss = (options: TExportOptions, spss: boolean): TExportOptions => ({
  ...options,
  spss: spss && isSpssAvailable(options),
  display: spss && options.display === "text" ? "codes" : options.display,
});

export const setDisplay = (options: TExportOptions, display: TAnswerDisplay): TExportOptions => {
  if (options.spss && display === "text") return { ...options, display: "codes" };
  return { ...options, display };
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
  scope: { filter?: TResponseFilterCriteria; responseIds?: string[] } = {}
): TExportRequest => {
  let filter: TResponseFilterCriteria | undefined;
  if (scope.responseIds) filter = { responseIds: scope.responseIds };
  else if (scope.filter) filter = scope.filter;
  return {
    format: options.format,
    display: options.display,
    spss: options.spss,
    advanced: options.advanced,
    ...(filter ? { filter } : {}),
  };
};
