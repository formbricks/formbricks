import { formatImportIssueMessage } from "./messages";
import type {
  TImportIssue,
  TImportIssueCode,
  TImportIssueSeverity,
  TImportReport,
  TImportReportSource,
  TImportReportSummary,
} from "./types";

type TIssueInput = {
  code: TImportIssueCode;
  path?: string;
  sourceRef?: string;
  vars?: Record<string, string | number>;
  /** Overrides the message template; the resolver passes v3 `invalid_params` reasons through. */
  message?: string;
};

export function createImportIssue(severity: TImportIssueSeverity, input: TIssueInput): TImportIssue {
  const vars = { ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}), ...input.vars };
  return {
    severity,
    code: input.code,
    message: input.message ?? formatImportIssueMessage(input.code, vars),
    ...(input.path ? { path: input.path } : {}),
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    ...(Object.keys(vars).length > 0 ? { vars } : {}),
  };
}

export const importError = (input: TIssueInput): TImportIssue => createImportIssue("error", input);
export const importWarning = (input: TIssueInput): TImportIssue => createImportIssue("warning", input);
export const importInfo = (input: TIssueInput): TImportIssue => createImportIssue("info", input);

export const EMPTY_IMPORT_SUMMARY: TImportReportSummary = {
  blocks: 0,
  elements: 0,
  endings: 0,
  languages: [],
  logicRules: 0,
  logicRulesReported: 0,
  hiddenFields: 0,
};

export function createImportReport(source: TImportReportSource, issues: TImportIssue[] = []): TImportReport {
  return { source, summary: { ...EMPTY_IMPORT_SUMMARY }, issues: [...issues] };
}

export function addIssue(report: TImportReport, issue: TImportIssue): TImportReport {
  report.issues.push(issue);
  return report;
}

export function hasFatalIssues(issues: readonly TImportIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

export function countIssues(issues: readonly TImportIssue[]): Record<TImportIssueSeverity, number> {
  return issues.reduce(
    (counts, issue) => {
      counts[issue.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0 }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Counts for the facts row. Tolerant by design: it runs on a candidate before validation, so every
 * field may be missing or malformed and simply counts as zero.
 */
export function summarizeDocument(document: unknown): TImportReportSummary {
  if (!isRecord(document)) {
    return { ...EMPTY_IMPORT_SUMMARY };
  }

  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  const elements = blocks.reduce<number>(
    (count, block) => count + (isRecord(block) && Array.isArray(block.elements) ? block.elements.length : 0),
    0
  );
  const logicRules = blocks.reduce<number>(
    (count, block) => count + (isRecord(block) && Array.isArray(block.logic) ? block.logic.length : 0),
    0
  );
  const endings = Array.isArray(document.endings) ? document.endings.length : 0;
  const hiddenFields =
    isRecord(document.hiddenFields) && Array.isArray(document.hiddenFields.fieldIds)
      ? document.hiddenFields.fieldIds.length
      : 0;

  const languages = new Set<string>();
  if (typeof document.defaultLanguage === "string") {
    languages.add(document.defaultLanguage);
  }
  if (Array.isArray(document.languages)) {
    for (const language of document.languages) {
      if (isRecord(language) && typeof language.code === "string") {
        languages.add(language.code);
      }
    }
  }

  return {
    blocks: blocks.length,
    elements,
    endings,
    languages: Array.from(languages),
    logicRules,
    logicRulesReported: 0,
    hiddenFields,
  };
}
