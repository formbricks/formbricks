import type { TQsfImportIssue, TQsfImportReport } from "@/modules/survey/import/types";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

const param = (issue: TQsfImportIssue, name: string): string => String(issue.params?.[name] ?? "");

/** Qualtrics' own name for a question type the import cannot bring over; an unknown code as sent. */
const getQualtricsTypeName = (type: string, t: TTranslate): string => {
  switch (type) {
    case "CS":
      return t("workspace.surveys.import.qualtrics_types.constant_sum");
    case "SBS":
      return t("workspace.surveys.import.qualtrics_types.side_by_side");
    case "HeatMap":
      return t("workspace.surveys.import.qualtrics_types.heat_map");
    case "HotSpot":
      return t("workspace.surveys.import.qualtrics_types.hot_spot");
    case "DD":
      return t("workspace.surveys.import.qualtrics_types.drill_down");
    case "PGR":
      return t("workspace.surveys.import.qualtrics_types.pick_group_rank");
    case "Highlight":
      return t("workspace.surveys.import.qualtrics_types.highlight");
    case "Signature":
      return t("workspace.surveys.import.qualtrics_types.signature");
    case "Draw":
      return t("workspace.surveys.import.qualtrics_types.drawing");
    case "GAP":
      return t("workspace.surveys.import.qualtrics_types.gap_analysis");
    case "Timing":
      return t("workspace.surveys.import.qualtrics_types.timing");
    case "Meta":
      return t("workspace.surveys.import.qualtrics_types.meta_info");
    case "Captcha":
      return t("workspace.surveys.import.qualtrics_types.captcha");
    default:
      return type;
  }
};

/** Why a question was left out, from the server's `params.cause`. */
const getSkippedQuestionMessage = (issue: TQsfImportIssue, t: TTranslate): string => {
  switch (param(issue, "cause")) {
    case "unsupported_type":
      return t("workspace.surveys.import.issues.question_skipped_unsupported_type", {
        type: getQualtricsTypeName(param(issue, "qualtricsType"), t),
      });
    case "ai_skipped": {
      const description = param(issue, "description");
      return description
        ? t("workspace.surveys.import.issues.question_skipped_by_ai", { description })
        : t("workspace.surveys.import.issues.question_skipped");
    }
    case "plan_invalid":
      return t("workspace.surveys.import.issues.question_skipped_plan_invalid");
    case "ai_budget":
      return t("workspace.surveys.import.issues.question_skipped_ai_budget");
    case "not_in_flow":
      return t("workspace.surveys.import.issues.question_skipped_not_in_flow");
    case "invalid_id":
      return t("workspace.surveys.import.issues.question_skipped_invalid_id");
    case "validation_failed":
      return t("workspace.surveys.import.issues.question_skipped_validation_failed");
    default:
      return t("workspace.surveys.import.issues.question_skipped");
  }
};

/**
 * One report line in the user's language. Literal `t()` calls per code, so the translation scanner
 * sees every key. `params` come from the file or the AI: callers render the result as text only.
 */
export const getQsfImportIssueMessage = (issue: TQsfImportIssue, t: TTranslate): string => {
  switch (issue.code) {
    case "logic_not_imported":
      return t("workspace.surveys.import.issues.logic_not_imported", {
        description: param(issue, "description"),
      });
    case "question_skipped":
      return getSkippedQuestionMessage(issue, t);
    case "image_dropped":
      return t("workspace.surveys.import.issues.image_dropped");
    case "script_dropped":
      return t("workspace.surveys.import.issues.script_dropped");
    case "formatting_dropped":
      return t("workspace.surveys.import.issues.formatting_dropped");
    case "headline_fallback":
      return t("workspace.surveys.import.issues.headline_fallback");
    case "field_renamed":
      return t("workspace.surveys.import.issues.field_renamed", {
        from: param(issue, "from"),
        to: param(issue, "to"),
      });
    case "external_url_removed":
      return t("workspace.surveys.import.issues.external_url_removed");
    default: {
      // Every code the types know is handled above, so a new code fails the build until it has a
      // line. A server newer than this client can still send one; it gets the generic line.
      const unhandled: never = issue.code;
      void unhandled;
      return t("workspace.surveys.import.issues.unknown");
    }
  }
};

/**
 * The line with what it is about, e.g. `Q12: Logic not imported: …`: the Qualtrics question, or for a
 * page's rule when none of its questions was imported, the page's block.
 */
export const getQsfImportIssueLine = (issue: TQsfImportIssue, t: TTranslate): string => {
  const message = getQsfImportIssueMessage(issue, t);
  const subject = issue.questionTag ?? param(issue, "block");
  return subject ? `${subject}: ${message}` : message;
};

/** Warnings first, then notes, keeping the server's order inside each. */
export const sortQsfImportIssues = (issues: readonly TQsfImportIssue[]): TQsfImportIssue[] => [
  ...issues.filter((issue) => issue.severity === "warning"),
  ...issues.filter((issue) => issue.severity !== "warning"),
];

export const hasQsfImportWarnings = (report: TQsfImportReport): boolean =>
  report.issues.some((issue) => issue.severity === "warning");

/** What the file turned into, at a glance: the facts row above the review list and the report's header. */
export const getQsfImportFacts = (summary: TQsfImportReport["summary"], t: TTranslate): string[] => {
  const facts = [
    t("workspace.surveys.import.facts.questions", { count: summary.questions }),
    t("workspace.surveys.import.facts.blocks", { count: summary.blocks }),
  ];
  if (summary.languages.length > 0) facts.push(summary.languages.join(" · "));
  if (summary.hiddenFields > 0) {
    facts.push(t("workspace.surveys.import.facts.hidden_fields", { count: summary.hiddenFields }));
  }
  if (summary.logicRules > 0) {
    facts.push(t("workspace.surveys.import.facts.logic_not_imported", { count: summary.logicRules }));
  }
  return facts;
};

/** The report as plain text, for Download and Copy (ENG-3605). Same lines the dialog shows. */
export const formatQsfImportReport = (report: TQsfImportReport, t: TTranslate): string => {
  const lines = [
    t("workspace.surveys.import.report.text_title", { fileName: report.source.fileName }),
    getQsfImportFacts(report.summary, t).join(" · "),
    "",
  ];

  if (report.issues.length === 0) {
    lines.push(t("workspace.surveys.import.report.empty"));
  }

  for (const issue of sortQsfImportIssues(report.issues)) {
    const severity =
      issue.severity === "warning"
        ? t("workspace.surveys.import.report.warning")
        : t("workspace.surveys.import.report.note");
    lines.push(`- ${severity}: ${getQsfImportIssueLine(issue, t)}`);
  }

  return `${lines.join("\n")}\n`;
};

/** `survey.qsf` → `survey-import-report.txt`. */
export const getQsfImportReportFileName = (fileName: string): string =>
  `${fileName.replace(/\.qsf$/i, "") || "survey"}-import-report.txt`;
