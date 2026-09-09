import type { TImportIssue, TImportIssueCode, TImportSourceKind } from "@/modules/survey/import/types";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

export type TImportFormat = "formbricks" | "qsf" | "docx" | "pdf" | "markdown" | "csv" | "xlsx";

/**
 * Translation lookups for the import dialog, written as literal `t("…")` calls per code so the
 * translation scanner sees every key. A dynamic `t(\`…${code}\`)` would read as unused and be pruned.
 */
export function translateImportIssueCode(
  code: TImportIssueCode,
  t: TTranslate,
  vars?: Record<string, unknown>
): string {
  switch (code) {
    case "unsupported_question_type":
      return t("workspace.surveys.import.issues.unsupported_question_type", vars);
    case "type_approximated":
      return t("workspace.surveys.import.issues.type_approximated", vars);
    case "unknown_element":
      return t("workspace.surveys.import.issues.unknown_element", vars);
    case "unknown_field_stripped":
      return t("workspace.surveys.import.issues.unknown_field_stripped", vars);
    case "invalid_document":
      return t("workspace.surveys.import.issues.invalid_document", vars);
    case "export_format_unsupported":
      return t("workspace.surveys.import.issues.export_format_unsupported", vars);
    case "legacy_questions_unsupported":
      return t("workspace.surveys.import.issues.legacy_questions_unsupported", vars);
    case "text_truncated":
      return t("workspace.surveys.import.issues.text_truncated", vars);
    case "choices_truncated":
      return t("workspace.surveys.import.issues.choices_truncated", vars);
    case "logic_dropped":
      return t("workspace.surveys.import.issues.logic_dropped", vars);
    case "pipe_stripped":
      return t("workspace.surveys.import.issues.pipe_stripped", vars);
    case "randomizer_flattened":
      return t("workspace.surveys.import.issues.randomizer_flattened", vars);
    case "block_not_in_flow":
      return t("workspace.surveys.import.issues.block_not_in_flow", vars);
    case "single_page_split":
      return t("workspace.surveys.import.issues.single_page_split", vars);
    case "welcome_card_from_descriptive_text":
      return t("workspace.surveys.import.issues.welcome_card_from_descriptive_text", vars);
    case "language_created":
      return t("workspace.surveys.import.issues.language_created", vars);
    case "language_ambiguous":
      return t("workspace.surveys.import.issues.language_ambiguous", vars);
    case "language_unknown":
      return t("workspace.surveys.import.issues.language_unknown", vars);
    case "translation_filled":
      return t("workspace.surveys.import.issues.translation_filled", vars);
    case "translation_missing":
      return t("workspace.surveys.import.issues.translation_missing", vars);
    case "trigger_mapped":
      return t("workspace.surveys.import.issues.trigger_mapped", vars);
    case "trigger_created":
      return t("workspace.surveys.import.issues.trigger_created", vars);
    case "trigger_dropped":
      return t("workspace.surveys.import.issues.trigger_dropped", vars);
    case "trigger_would_be_created":
      return t("workspace.surveys.import.issues.trigger_would_be_created", vars);
    case "targeting_not_imported":
      return t("workspace.surveys.import.issues.targeting_not_imported", vars);
    case "quota_dropped":
      return t("workspace.surveys.import.issues.quota_dropped", vars);
    case "settings_not_exported":
      return t("workspace.surveys.import.issues.settings_not_exported", vars);
    case "setting_not_imported":
      return t("workspace.surveys.import.issues.setting_not_imported", vars);
    case "slug_not_imported":
      return t("workspace.surveys.import.issues.slug_not_imported", vars);
    case "schedule_cleared":
      return t("workspace.surveys.import.issues.schedule_cleared", vars);
    case "status_reset":
      return t("workspace.surveys.import.issues.status_reset", vars);
    case "external_url_removed":
      return t("workspace.surveys.import.issues.external_url_removed", vars);
    case "asset_url_external":
      return t("workspace.surveys.import.issues.asset_url_external", vars);
    case "media_invalid":
      return t("workspace.surveys.import.issues.media_invalid", vars);
    case "embedded_data_name_refused":
      return t("workspace.surveys.import.issues.embedded_data_name_refused", vars);
    case "field_renamed":
      return t("workspace.surveys.import.issues.field_renamed", vars);
    case "no_text_extracted":
      return t("workspace.surveys.import.issues.no_text_extracted", vars);
    case "archive_rejected":
      return t("workspace.surveys.import.issues.archive_rejected", vars);
    case "document_encrypted":
      return t("workspace.surveys.import.issues.document_encrypted", vars);
    case "nothing_extracted":
      return t("workspace.surveys.import.issues.nothing_extracted", vars);
    case "chunked":
      return t("workspace.surveys.import.issues.chunked", vars);
    case "chunk_failed":
      return t("workspace.surveys.import.issues.chunk_failed", vars);
    case "model_note":
      return t("workspace.surveys.import.issues.model_note", vars);
    default:
      return "";
  }
}

/** The user's language for a report row, falling back to the server's English message. */
export function getImportIssueMessage(issue: TImportIssue, t: TTranslate): string {
  const translated = translateImportIssueCode(issue.code, t, { ...issue.vars, defaultValue: issue.message });
  return translated.length > 0 && !translated.startsWith("workspace.surveys.import.issues.")
    ? translated
    : issue.message;
}

export function getImportFormatLabel(format: TImportFormat, t: TTranslate): string {
  switch (format) {
    case "formbricks":
      return t("workspace.surveys.import.format_formbricks");
    case "qsf":
      return t("workspace.surveys.import.format_qsf");
    case "docx":
      return t("workspace.surveys.import.format_docx");
    case "pdf":
      return t("workspace.surveys.import.format_pdf");
    case "markdown":
      return t("workspace.surveys.import.format_markdown");
    case "csv":
      return t("workspace.surveys.import.format_csv");
    case "xlsx":
      return t("workspace.surveys.import.format_xlsx");
  }
}

export function getImportSourceLabel(kind: TImportSourceKind, t: TTranslate): string {
  switch (kind) {
    case "formbricks-export":
      return t("workspace.surveys.import.source_formbricks-export");
    case "v3-document":
      return t("workspace.surveys.import.source_v3-document");
    case "qsf":
      return t("workspace.surveys.import.source_qsf");
    case "docx":
      return t("workspace.surveys.import.source_docx");
    case "pdf":
      return t("workspace.surveys.import.source_pdf");
    case "markdown":
      return t("workspace.surveys.import.source_markdown");
    case "text":
      return t("workspace.surveys.import.source_text");
    case "csv":
      return t("workspace.surveys.import.source_csv");
    case "xlsx":
      return t("workspace.surveys.import.source_xlsx");
  }
}
