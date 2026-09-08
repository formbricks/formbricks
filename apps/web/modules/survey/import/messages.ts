import type { TImportIssueCode } from "./types";

type TVars = Record<string, string | number>;

const str = (vars: TVars | undefined, key: string, fallback = ""): string => {
  const value = vars?.[key];
  return value === undefined ? fallback : String(value);
};

/**
 * English message per issue code. The API returns these; the dialog translates by `code` with the
 * same `vars` and falls back to this text.
 */
const MESSAGES: Record<TImportIssueCode, (vars?: TVars) => string> = {
  unsupported_question_type: (v) =>
    `${str(v, "sourceRef", "A question")} uses the type '${str(v, "type")}', which Formbricks does not support. It was not imported.`,
  type_approximated: (v) =>
    `${str(v, "sourceRef", "A question")} was imported as '${str(v, "to")}' because '${str(v, "from")}' has no exact equivalent.`,
  unknown_element: (v) =>
    `Unknown element type '${str(v, "type")}'. This file was made by a newer Formbricks version.`,
  unknown_field_stripped: (v) =>
    `The field '${str(v, "field")}' is not part of a survey document and was removed.`,
  invalid_document: (v) => str(v, "detail", "The file is not a survey document Formbricks can read."),
  export_format_unsupported: (v) =>
    `This file uses export format ${str(v, "format")}, which this Formbricks version cannot read. Export it again from a current instance or upgrade.`,
  legacy_questions_unsupported: () =>
    "This file uses the legacy question format. Export the survey again from a current Formbricks instance.",
  text_truncated: (v) => `Text was shortened to ${str(v, "max")} characters.`,
  choices_truncated: (v) => `Only the first ${str(v, "max")} options were kept.`,
  logic_dropped: (v) => str(v, "detail", "A logic rule was not imported. Rebuild it in the editor."),
  pipe_stripped: (v) => `The piped text '${str(v, "token")}' has no equivalent and was removed.`,
  randomizer_flattened: () => "Randomized blocks were imported in file order. Randomization is not imported.",
  block_not_in_flow: (v) =>
    `Block '${str(v, "block")}' is not part of the survey flow and was appended at the end.`,
  single_page_split: (v) =>
    `The Qualtrics survey has no page breaks, so each of its ${str(v, "count")} questions was placed in its own block.`,
  welcome_card_from_descriptive_text: () => "The first text page became the welcome card.",
  language_created: (v) =>
    `Language '${str(v, "code")}' does not exist in this workspace yet and will be created.`,
  language_ambiguous: (v) =>
    `The document language is ambiguous (${str(v, "reasons")}). Only '${str(v, "code")}' was imported.`,
  language_unknown: (v) =>
    `Language code '${str(v, "code")}' is not recognized. Its texts were kept under the default language.`,
  translation_filled: (v) =>
    `Missing '${str(v, "code")}' translation was filled with the default-language text.`,
  translation_missing: (v) => `Missing '${str(v, "code")}' translation.`,
  trigger_mapped: (v) => `Trigger '${str(v, "name")}' was matched to an existing action in this workspace.`,
  trigger_created: (v) => `Trigger '${str(v, "name")}' was created in this workspace.`,
  trigger_dropped: (v) =>
    `Trigger '${str(v, "name", str(v, "id"))}' has no definition in the file and was removed.`,
  trigger_would_be_created: (v) => `Trigger '${str(v, "name")}' will be created in this workspace on import.`,
  targeting_not_imported: () => "Targeting (segment filters) is not imported. Set it up in the editor.",
  quota_dropped: () => "Quotas are not imported.",
  settings_not_exported: () =>
    "Styling, follow-ups and survey settings are not part of the export. Set them up in the editor.",
  setting_not_imported: (v) => `The setting '${str(v, "setting")}' is not imported. Set it up in the editor.`,
  slug_not_imported: () => "The survey link slug is unique per instance and was not imported.",
  schedule_cleared: () => "The publish and close schedule was cleared. The survey is created as a draft.",
  status_reset: () => "The survey is created as a draft regardless of its status in the file.",
  external_url_removed: () =>
    "External links are not available on this plan. The link was removed; the survey still works.",
  asset_url_external: () =>
    "An image or video points at another Formbricks instance. It keeps working as long as that instance serves it.",
  media_invalid: (v) => `The media URL '${str(v, "url")}' is not supported and was removed.`,
  embedded_data_name_refused: (v) =>
    `The hidden field '${str(v, "name")}' uses a reserved name and was renamed to '${str(v, "renamed")}'.`,
  field_renamed: (v) =>
    `The field '${str(v, "from")}' was renamed to '${str(v, "to")}' to follow the naming rules.`,
  no_text_extracted: () => "We couldn't find any text in this file. Scanned PDFs need OCR first.",
  archive_rejected: () => "This file could not be opened safely and was rejected.",
  document_encrypted: () => "This PDF is password-protected. Remove the password and try again.",
  document_unreadable: (v) => `We couldn't read this file (${str(v, "detail")}). It may be corrupted.`,
  extraction_timeout: () => "Reading this file took too long. Try a smaller or simpler file.",
  nothing_extracted: () => "No questions were found in this document.",
  chunked: (v) => `The document was read in ${str(v, "count")} parts.`,
  chunk_failed: (v) =>
    `Part ${str(v, "index")} of ${str(v, "total")} could not be read. The rest was imported.`,
  model_note: (v) => str(v, "detail"),
};

export function formatImportIssueMessage(code: TImportIssueCode, vars?: TVars): string {
  return MESSAGES[code](vars);
}
