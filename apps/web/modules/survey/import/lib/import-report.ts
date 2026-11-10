import { AI_FILE_EXTENSIONS, FORMBRICKS_FILE_INPUT_EXTENSION } from "@/modules/survey/import/lib/import-file";
import type {
  TSurveyImportIssue,
  TSurveyImportIssuePlace,
  TSurveyImportReport,
} from "@/modules/survey/import/types";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

const param = (issue: TSurveyImportIssue, name: string): string => String(issue.params?.[name] ?? "");
const count = (issue: TSurveyImportIssue): number => Number(issue.params?.count ?? 0);

/** A language left out: the survey's default one (with what stands in), a named one, or one with no usable code. */
const getSkippedLanguageMessage = (issue: TSurveyImportIssue, t: TTranslate): string => {
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

/** The name of the encoding a text file was read as; an unknown one as sent. */
const getEncodingName = (encoding: string, t: TTranslate): string => {
  switch (encoding) {
    case "utf-8":
      return t("workspace.surveys.import.encodings.utf_8");
    case "utf-16le":
    case "utf-16be":
      return t("workspace.surveys.import.encodings.utf_16");
    case "windows-1252":
      return t("workspace.surveys.import.encodings.windows_1252");
    default:
      return encoding;
  }
};

/** Why a question was left out, from the server's `params.cause`. */
const getSkippedQuestionMessage = (issue: TSurveyImportIssue, t: TTranslate): string => {
  switch (param(issue, "cause")) {
    case "unsupported_type":
      return t("workspace.surveys.import.issues.question_skipped_unsupported_type", {
        type: getQualtricsTypeName(param(issue, "qualtricsType"), t),
      });
    case "ai_skipped": {
      const description = param(issue, "description");
      return description
        ? t("workspace.surveys.import.issues.question_skipped_by_ai", { description })
        : t("workspace.surveys.import.issues.question_skipped_ai_skipped");
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
    case "cells_taken":
      return t("workspace.surveys.import.issues.question_skipped_cells_taken");
    default:
      return t("workspace.surveys.import.issues.question_skipped");
  }
};

/**
 * One report line per code, in the user's language. Literal `t()` calls per code, so the translation
 * scanner sees every key; typed over every code, so a new code fails the build until it has a line.
 */
const ISSUE_MESSAGES: Record<
  TSurveyImportIssue["code"],
  (issue: TSurveyImportIssue, t: TTranslate) => string
> = {
  logic_not_imported: (issue, t) => {
    const description = param(issue, "description");
    return description
      ? t("workspace.surveys.import.issues.logic_not_imported", { description })
      : t("workspace.surveys.import.issues.logic_not_imported_no_description");
  },
  question_skipped: (issue, t) => getSkippedQuestionMessage(issue, t),
  image_dropped: (_issue, t) => t("workspace.surveys.import.issues.image_dropped"),
  script_dropped: (_issue, t) => t("workspace.surveys.import.issues.script_dropped"),
  formatting_dropped: (_issue, t) => t("workspace.surveys.import.issues.formatting_dropped"),
  headline_fallback: (_issue, t) => t("workspace.surveys.import.issues.headline_fallback"),
  field_renamed: (issue, t) =>
    t("workspace.surveys.import.issues.field_renamed", {
      from: param(issue, "from"),
      to: param(issue, "to"),
    }),
  external_url_removed: (_issue, t) => t("workspace.surveys.import.issues.external_url_removed"),
  field_dropped: (issue, t) => t("workspace.surveys.import.issues.field_dropped", { count: count(issue) }),
  language_skipped: (issue, t) => getSkippedLanguageMessage(issue, t),
  translation_missing: (issue, t) =>
    t("workspace.surveys.import.issues.translation_missing", {
      count: count(issue),
      language: param(issue, "language"),
    }),
  piped_text_removed: (issue, t) =>
    t("workspace.surveys.import.issues.piped_text_removed", { count: count(issue) }),
  choice_label_renamed: (_issue, t) => t("workspace.surveys.import.issues.choice_label_renamed"),
  choice_dropped: (_issue, t) => t("workspace.surveys.import.issues.choice_dropped"),
  text_too_long: (_issue, t) => t("workspace.surveys.import.issues.text_too_long"),
  markup_escaped: (_issue, t) => t("workspace.surveys.import.issues.markup_escaped"),
  matrix_single_answer: (_issue, t) => t("workspace.surveys.import.issues.matrix_single_answer"),
  options_left_out: (issue, t) =>
    t("workspace.surveys.import.issues.options_left_out", {
      count: count(issue),
      options: param(issue, "options"),
    }),
  scale_changed: (issue, t) =>
    t("workspace.surveys.import.issues.scale_changed", {
      from: param(issue, "from"),
      to: param(issue, "to"),
    }),
  ending_added: (_issue, t) => t("workspace.surveys.import.issues.ending_added"),
  ending_not_translated: (issue, t) =>
    t("workspace.surveys.import.issues.ending_not_translated", {
      languages: param(issue, "languages"),
    }),
  // Past the first fifty, one line counts the rest instead of naming each.
  unknown_key_dropped: (issue, t) =>
    issue.params?.field === undefined
      ? t("workspace.surveys.import.issues.unknown_keys_dropped", { count: count(issue) })
      : t("workspace.surveys.import.issues.unknown_key_dropped", { field: param(issue, "field") }),
  custom_css_removed: (_issue, t) => t("workspace.surveys.import.issues.custom_css_removed"),
  targeting_removed: (_issue, t) => t("workspace.surveys.import.issues.targeting_removed"),
  targeting_filter_removed: (issue, t) =>
    t("workspace.surveys.import.issues.targeting_filter_removed", { count: count(issue) }),
  action_class_created: (issue, t) =>
    t("workspace.surveys.import.issues.action_class_created", { name: param(issue, "name") }),
  attribute_key_created: (issue, t) =>
    t("workspace.surveys.import.issues.attribute_key_created", { key: param(issue, "key") }),
  content_only: (_issue, t) => t("workspace.surveys.import.issues.content_only"),
  logic_imported: (issue, t) => {
    const description = param(issue, "description");
    return description
      ? t("workspace.surveys.import.issues.logic_imported", { description })
      : t("workspace.surveys.import.issues.logic_imported_no_description");
  },
  text_not_split: (issue, t) =>
    t("workspace.surveys.import.issues.text_not_split", { cell: param(issue, "cell") }),
  lines_unread: (issue, t) => t("workspace.surveys.import.issues.lines_unread", { count: count(issue) }),
  file_encoding: (issue, t) =>
    t("workspace.surveys.import.issues.file_encoding", {
      encoding: getEncodingName(param(issue, "encoding"), t),
    }),
  sheets_skipped: (issue, t) =>
    t("workspace.surveys.import.issues.sheets_skipped", { sheets: param(issue, "sheets") }),
  table_as_matrix: (_issue, t) => t("workspace.surveys.import.issues.table_as_matrix"),
  images_not_imported: (issue, t) =>
    t("workspace.surveys.import.issues.images_not_imported", { count: count(issue) }),
  question_removed: (issue, t) => {
    const headline = param(issue, "headline");
    return headline
      ? t("workspace.surveys.import.issues.question_removed", { headline })
      : t("workspace.surveys.import.issues.question_removed_no_headline");
  },
  option_removed: (issue, t) =>
    t("workspace.surveys.import.issues.option_removed", { option: param(issue, "option") }),
};

/**
 * One report line in the user's language. `params` come from the file or the AI: callers render the
 * result as text only.
 */
export const getSurveyImportIssueMessage = (issue: TSurveyImportIssue, t: TTranslate): string =>
  // A server newer than this client can still send a code it does not know.
  Object.hasOwn(ISSUE_MESSAGES, issue.code)
    ? ISSUE_MESSAGES[issue.code](issue, t)
    : t("workspace.surveys.import.issues.unknown");

/** Where a document's question starts: "Row 5", "Paragraph 12", "Table 1, row 2". */
const getPlaceText = (place: TSurveyImportIssuePlace, t: TTranslate): string => {
  switch (place.kind) {
    case "row":
      return t("workspace.surveys.import.report.place_row", { row: place.row });
    case "paragraph":
      return t("workspace.surveys.import.report.place_paragraph", { paragraph: place.paragraph });
    case "table_row":
      return t("workspace.surveys.import.report.place_table_row", { table: place.table, row: place.row });
    default:
      // A server newer than this client can send a kind it does not know.
      return "";
  }
};

/**
 * What a line is about. A document's question (it has a `place`) reads as the ID the file gives it,
 * "Question 03", or, without one, as where it starts, "Row 5"; its text follows when the file has one
 * (ENG-7070). Any other line keeps the file's own label (a Qualtrics export tag, `Q12`), the end
 * message, or for a page's rule when none of its questions was imported, the page's block.
 */
const getSurveyImportIssueSubject = (issue: TSurveyImportIssue, t: TTranslate): string => {
  const { place, questionTag, questionText } = issue;
  let subject: string;
  if (place) {
    subject = questionTag
      ? t("workspace.surveys.import.report.question_tag", { tag: questionTag })
      : getPlaceText(place, t);
  } else {
    subject =
      questionTag ??
      (param(issue, "subject") === "ending"
        ? t("workspace.surveys.import.report.ending")
        : param(issue, "block"));
  }
  if (!questionText) return subject;
  return subject
    ? t("workspace.surveys.import.report.subject_with_text", { subject, text: questionText })
    : t("workspace.surveys.import.report.subject_text", { text: questionText });
};

/** The line with what it is about, e.g. `Q12: Logic not imported: …` or `Row 5 · “How often…”: …`. */
export const getSurveyImportIssueLine = (issue: TSurveyImportIssue, t: TTranslate): string => {
  const message = getSurveyImportIssueMessage(issue, t);
  const subject = getSurveyImportIssueSubject(issue, t);
  return subject ? `${subject}: ${message}` : message;
};

/**
 * The kinds the report's header counts by name (ENG-7070), in the order the lines are listed: the same
 * things the review's facts row counts, so "3 logic rules to check" reads the same in both. A warning
 * of any other code counts as `other`; every note as `note`.
 */
const ISSUE_GROUPS = ["logic_to_check", "logic_not_imported", "question_skipped", "other", "note"] as const;
type TIssueGroup = (typeof ISSUE_GROUPS)[number];

const getIssueGroup = (issue: TSurveyImportIssue): TIssueGroup => {
  if (issue.severity !== "warning") return "note";
  switch (issue.code) {
    case "logic_imported":
      return "logic_to_check";
    case "logic_not_imported":
    case "question_skipped":
      return issue.code;
    default:
      return "other";
  }
};

/** Warnings first, by kind, then notes, keeping the server's order inside each. */
export const sortSurveyImportIssues = (issues: readonly TSurveyImportIssue[]): TSurveyImportIssue[] =>
  ISSUE_GROUPS.flatMap((group) => issues.filter((issue) => getIssueGroup(issue) === group));

/**
 * The report's header: what the warnings are, then the notes, e.g. `3 logic rules to check`,
 * `1 question skipped`, `2 notes`. Warnings of no named kind are "2 warnings" on their own and
 * "2 other warnings" after a named kind. Empty when the report has no line.
 */
export const getSurveyImportIssueSummary = (
  issues: readonly TSurveyImportIssue[],
  t: TTranslate
): string[] => {
  const counts = Object.fromEntries(ISSUE_GROUPS.map((group) => [group, 0])) as Record<TIssueGroup, number>;
  for (const issue of issues) counts[getIssueGroup(issue)] += 1;
  const named = counts.logic_to_check + counts.logic_not_imported + counts.question_skipped;

  const summary: string[] = [];
  if (counts.logic_to_check > 0) {
    summary.push(t("workspace.surveys.import.facts.logic_to_check", { count: counts.logic_to_check }));
  }
  if (counts.logic_not_imported > 0) {
    summary.push(
      t("workspace.surveys.import.facts.logic_not_imported", { count: counts.logic_not_imported })
    );
  }
  if (counts.question_skipped > 0) {
    summary.push(
      t("workspace.surveys.import.report.summary_questions_skipped", { count: counts.question_skipped })
    );
  }
  if (counts.other > 0) {
    summary.push(
      named > 0
        ? t("workspace.surveys.import.report.summary_other_warnings", { count: counts.other })
        : t("workspace.surveys.import.report.summary_warnings", { count: counts.other })
    );
  }
  if (counts.note > 0) {
    summary.push(t("workspace.surveys.import.report.summary_notes", { count: counts.note }));
  }
  return summary;
};

/** How many lines of the file the AI never read (`lines_unread`); 0 when it read them all. */
export const getUnreadLineCount = (report: TSurveyImportReport): number =>
  report.issues
    .filter((issue) => issue.code === "lines_unread")
    .reduce((total, issue) => total + count(issue), 0);

/**
 * The languages the draft imports switched off, because texts are missing in them: the review names
 * them above the save button, so nobody publishes without noticing.
 */
export const getSwitchedOffLanguages = (report: TSurveyImportReport): string[] => [
  ...new Set(
    report.issues
      .filter((issue) => issue.code === "translation_missing")
      .map((issue) => param(issue, "language"))
  ),
];

export const hasSurveyImportWarnings = (report: TSurveyImportReport): boolean =>
  report.issues.some((issue) => issue.severity === "warning");

/** What the file turned into, at a glance: the facts row above the review list and the report's header. */
export const getSurveyImportFacts = (summary: TSurveyImportReport["summary"], t: TTranslate): string[] => {
  const facts = [
    t("workspace.surveys.import.facts.questions", { count: summary.questions }),
    t("workspace.surveys.import.facts.blocks", { count: summary.blocks }),
  ];
  // Joined with commas: the facts themselves are joined with middle dots.
  if (summary.languages.length > 0) facts.push(summary.languages.join(", "));
  if (summary.hiddenFields > 0) {
    facts.push(t("workspace.surveys.import.facts.hidden_fields", { count: summary.hiddenFields }));
  }
  if (summary.importedLogicRules > 0) {
    facts.push(t("workspace.surveys.import.facts.logic_to_check", { count: summary.importedLogicRules }));
  }
  if (summary.logicRules > 0) {
    facts.push(t("workspace.surveys.import.facts.logic_not_imported", { count: summary.logicRules }));
  }
  return facts;
};

/** The report as plain text, for Download (ENG-3605). Same lines the dialog shows. */
export const formatSurveyImportReport = (report: TSurveyImportReport, t: TTranslate): string => {
  const lines = [
    t("workspace.surveys.import.report.text_title", { fileName: report.source.fileName }),
    getSurveyImportFacts(report.summary, t).join(" · "),
    "",
  ];

  if (report.issues.length === 0) {
    lines.push(t("workspace.surveys.import.report.empty"));
  }

  for (const issue of sortSurveyImportIssues(report.issues)) {
    const severity =
      issue.severity === "warning"
        ? t("workspace.surveys.import.report.warning")
        : t("workspace.surveys.import.report.note");
    lines.push(`- ${severity}: ${getSurveyImportIssueLine(issue, t)}`);
  }

  return `${lines.join("\n")}\n`;
};

/**
 * Every ending an imported file can have, longest first so `.formbricks.json` goes before `.json`. Built
 * from the extensions the drop zone accepts, so a new file type needs no second list (ENG-7071).
 */
const IMPORT_FILE_ENDINGS = [
  `.formbricks${FORMBRICKS_FILE_INPUT_EXTENSION}`,
  FORMBRICKS_FILE_INPUT_EXTENSION,
  ...AI_FILE_EXTENSIONS,
].toSorted((a, b) => b.length - a.length);

/** `survey.qsf`, `survey.formbricks.json` or `survey.docx` → `survey-import-report.txt`. */
export const getSurveyImportReportFileName = (fileName: string): string => {
  const lowerCased = fileName.toLowerCase();
  const ending = IMPORT_FILE_ENDINGS.find((candidate) => lowerCased.endsWith(candidate)) ?? "";
  return `${fileName.slice(0, fileName.length - ending.length) || "survey"}-import-report.txt`;
};
