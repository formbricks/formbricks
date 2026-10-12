import type { TQsfImportIssue } from "../types";
import type { TQsfQuestion } from "./qsf-model";

/**
 * Qualtrics types Formbricks has no element for. Their questions are skipped without asking the model —
 * fewer tokens, and the severity is ours to set — and the size fit before the plan does not weigh them,
 * since no draft ever holds one.
 */
const UNSUPPORTED_TYPES: ReadonlyMap<string, TQsfImportIssue["severity"]> = new Map([
  ["CS", "warning"],
  ["SBS", "warning"],
  ["HeatMap", "warning"],
  ["HotSpot", "warning"],
  ["DD", "warning"],
  ["PGR", "warning"],
  ["Highlight", "warning"],
  ["Signature", "warning"],
  ["Draw", "warning"],
  ["GAP", "warning"],
  ["Timing", "info"],
  ["Meta", "info"],
  ["Captcha", "info"],
]);

/** The report severity for a question the import skips for its type, or `null` for one it may keep. */
export const unsupportedTypeSeverity = (question: TQsfQuestion): TQsfImportIssue["severity"] | null =>
  UNSUPPORTED_TYPES.get(question.qualtricsType) ?? null;

/** Whether the import skips a question for its type, before planning. */
export const isUnsupportedType = (question: TQsfQuestion): boolean =>
  unsupportedTypeSeverity(question) !== null;
