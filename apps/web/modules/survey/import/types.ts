import type { TSurveyExportReferences } from "@/app/api/v3/surveys/export/schemas";

/**
 * Shared vocabulary of the survey import pipeline. Every lane (lossless JSON, structured QSF, AI
 * documents) produces a `TImportCandidate`; the resolver turns it into a create document and a report.
 */

export const IMPORT_SOURCE_KINDS = [
  "formbricks-export",
  "v3-document",
  "qsf",
  "docx",
  "pdf",
  "markdown",
  "text",
  "csv",
  "xlsx",
] as const;

export type TImportSourceKind = (typeof IMPORT_SOURCE_KINDS)[number];

export type TImportLane = "lossless" | "structured" | "ai";

export const IMPORT_LANE_BY_KIND: Record<TImportSourceKind, TImportLane> = {
  "formbricks-export": "lossless",
  "v3-document": "lossless",
  qsf: "structured",
  docx: "ai",
  pdf: "ai",
  markdown: "ai",
  text: "ai",
  csv: "ai",
  xlsx: "ai",
};

export const AI_IMPORT_SOURCE_KINDS: readonly TImportSourceKind[] = IMPORT_SOURCE_KINDS.filter(
  (kind) => IMPORT_LANE_BY_KIND[kind] === "ai"
);

/** 15 MB per file (D3). The transport adds 1 MB of multipart slack on top. */
export const IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * Import owns its own allowlist. `ZAllowedFileExtension` (packages/types/storage.ts) is the upload
 * allowlist for survey media and deliberately lacks `.qsf` and `.md` (edge case #36).
 */
export const IMPORT_ALLOWED_EXTENSIONS = {
  json: ["application/json", "text/json"],
  qsf: ["application/json", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pdf: ["application/pdf"],
  md: ["text/markdown", "text/x-markdown", "text/plain"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "text/plain"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
} as const satisfies Record<string, readonly string[]>;

export type TImportAllowedExtension = keyof typeof IMPORT_ALLOWED_EXTENSIONS;

/** Legacy Office formats are refused with a "save as" hint instead of a generic rejection. */
export const IMPORT_LEGACY_OFFICE_EXTENSIONS = ["doc", "xls", "rtf", "odt", "ods"] as const;

export const IMPORT_ISSUE_CODES = [
  // Structure and types
  "unsupported_question_type",
  "type_approximated",
  "unknown_element",
  "unknown_field_stripped",
  "invalid_document",
  "export_format_unsupported",
  "legacy_questions_unsupported",
  "text_truncated",
  "choices_truncated",
  // Logic and pipes
  "logic_dropped",
  "pipe_stripped",
  "randomizer_flattened",
  "block_not_in_flow",
  "welcome_card_from_descriptive_text",
  // Languages
  "language_created",
  "language_ambiguous",
  "language_unknown",
  "translation_filled",
  "translation_missing",
  // Workspace references
  "trigger_mapped",
  "trigger_created",
  "trigger_dropped",
  "trigger_would_be_created",
  "targeting_not_imported",
  "quota_dropped",
  // Settings and hygiene
  "settings_not_exported",
  "setting_not_imported",
  "slug_not_imported",
  "schedule_cleared",
  "status_reset",
  "external_url_removed",
  "asset_url_external",
  "media_invalid",
  // Hidden fields / embedded data
  "embedded_data_name_refused",
  "field_renamed",
  // Documents (AI lane)
  "no_text_extracted",
  "archive_rejected",
  "document_encrypted",
  "nothing_extracted",
  "chunked",
  "chunk_failed",
  "model_note",
] as const;

export type TImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

export type TImportIssueSeverity = "error" | "warning" | "info";

export type TImportIssue = {
  severity: TImportIssueSeverity;
  code: TImportIssueCode;
  /** v3 document path (`blocks.2.elements.0.headline`) when the issue points at one place. */
  path?: string;
  /** English fallback; the UI translates by `code` and `vars`. */
  message: string;
  /** Where in the source the issue comes from (a QSF `QID`, a document heading). */
  sourceRef?: string;
  /** Interpolation values for the translated message. */
  vars?: Record<string, string | number>;
};

export type TImportDetectedLanguage = { code: string; confidence: number };

export type TImportReportSource = {
  lane: TImportLane;
  kind: TImportSourceKind;
  fileName?: string;
  detectedLanguages?: TImportDetectedLanguage[];
  /** Number of model calls the AI lane made for this file. */
  chunks?: number;
};

export type TImportReportSummary = {
  blocks: number;
  elements: number;
  endings: number;
  languages: string[];
  logicRules: number;
  logicRulesReported: number;
  hiddenFields: number;
};

export type TImportReport = {
  source: TImportReportSource;
  summary: TImportReportSummary;
  issues: TImportIssue[];
};

/**
 * What a lane hands to the resolver. `document` stays `unknown` until the resolver has stripped and
 * validated it; `references` carries the action-class definitions an export travelled with.
 */
export type TImportCandidate = {
  document: unknown;
  references?: TSurveyExportReferences;
  issues: TImportIssue[];
  source: TImportReportSource;
};

export type TImportSourceContent =
  | { type: "bytes"; bytes: Buffer }
  | { type: "text"; text: string }
  | { type: "json"; value: unknown };

/** Server-side lane input: raw bytes, text or an already-parsed JSON body — never a `File`. */
export type TImportLaneInput = {
  kind: TImportSourceKind;
  fileName?: string;
  content: TImportSourceContent;
};

export type TImportProgressStage = "reading" | "detecting_languages" | "extracting" | "validating";

export type TImportProgress = {
  stage: TImportProgressStage;
  chunk?: { index: number; total: number };
  detail?: string;
};

export type TImportContext = {
  workspaceId: string;
  organizationId: string;
  userId: string | null;
  requestId: string;
  /** Cuid shared by every log line of one import run. */
  importRunId: string;
  /** Hint from the dialog (the workspace default) that breaks language-detection ties. */
  languageHint?: string;
  signal?: AbortSignal;
  onProgress?: (progress: TImportProgress) => void;
  /** Streams partial drafts to the dialog; `blockOffset` counts blocks already finalized by earlier chunks. */
  onPartial?: (draft: unknown, blockOffset: number) => void;
};

export type TImportLaneHandler = (input: TImportLaneInput, ctx: TImportContext) => Promise<TImportCandidate>;
