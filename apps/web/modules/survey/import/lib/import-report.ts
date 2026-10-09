import type { TQsfImportIssue, TQsfImportReport } from "@/modules/survey/import/types";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

const param = (issue: TQsfImportIssue, name: string): string => String(issue.params?.[name] ?? "");
const count = (issue: TQsfImportIssue): number => Number(issue.params?.count ?? 0);

/** A language left out: the survey's default one (with what stands in), a named one, or one with no usable code. */
const getSkippedLanguageMessage = (issue: TQsfImportIssue, t: TTranslate): string => {
  const code = param(issue, "code");
  const fallback = param(issue, "fallback");
  switch (param(issue, "cause")) {
    case "draft_too_large":
      return t("workspace.surveys.import.issues.language_skipped_too_large", { code });
    case "duplicate_language":
      return t("workspace.surveys.import.issues.language_skipped_duplicate", {
        code,
        language: param(issue, "language"),
      });
    default:
      break;
  }
  if (fallback) return t("workspace.surveys.import.issues.language_skipped_default", { code, fallback });
  return code
    ? t("workspace.surveys.import.issues.language_skipped", { code })
    : t("workspace.surveys.import.issues.language_skipped_unnamed");
};

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
    case "ai_timeout":
      return t("workspace.surveys.import.issues.question_skipped_ai_timeout");
    case "draft_too_large":
      return t("workspace.surveys.import.issues.question_skipped_draft_too_large");
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
 * The generic line. Its code is typed `never`: every code the types know is handled in
 * `getQsfImportIssueMessage`, so a new code fails the build until it has a line of its own.
 */
const getUnknownIssueMessage = (_code: never, t: TTranslate): string =>
  t("workspace.surveys.import.issues.unknown");

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
    case "field_dropped":
      return t("workspace.surveys.import.issues.field_dropped", { count: count(issue) });
    case "language_skipped":
      return getSkippedLanguageMessage(issue, t);
    case "translation_missing":
      return t("workspace.surveys.import.issues.translation_missing", {
        count: count(issue),
        language: param(issue, "language"),
      });
    case "piped_text_removed":
      return t("workspace.surveys.import.issues.piped_text_removed", { count: count(issue) });
    case "choice_label_renamed":
      return t("workspace.surveys.import.issues.choice_label_renamed");
    case "choice_dropped":
      return t("workspace.surveys.import.issues.choice_dropped");
    case "text_too_long":
      return t("workspace.surveys.import.issues.text_too_long");
    case "markup_escaped":
      return t("workspace.surveys.import.issues.markup_escaped");
    case "matrix_single_answer":
      return t("workspace.surveys.import.issues.matrix_single_answer");
    case "ending_added":
      return t("workspace.surveys.import.issues.ending_added");
    default:
      // A server newer than this client can still send a code it does not know.
      return getUnknownIssueMessage(issue.code, t);
  }
};

/**
 * The line with what it is about, e.g. `Q12: Logic not imported: …`: the Qualtrics question, the end
 * message, or for a page's rule when none of its questions was imported, the page's block.
 */
export const getQsfImportIssueLine = (issue: TQsfImportIssue, t: TTranslate): string => {
  const message = getQsfImportIssueMessage(issue, t);
  const subject =
    issue.questionTag ??
    (param(issue, "subject") === "ending"
      ? t("workspace.surveys.import.report.ending")
      : param(issue, "block"));
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
