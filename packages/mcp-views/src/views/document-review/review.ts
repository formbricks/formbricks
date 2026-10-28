/**
 * The logic behind the change-review view, kept out of the component so it can be tested: reading the
 * tool result (the server's `ZDocumentReview` in apps/web/modules/mcp/apps/document-review/review.ts,
 * declared again here because a view cannot import from the web app), deciding whether the person may
 * approve, and building the exact arguments of the push that approval sends.
 */
import type { ToolResult } from "../../shared/tool-result";

export type DocumentKind = "survey" | "creative" | "workflow";
export type ReviewStatus = "valid" | "stale" | "destructive" | "invalid";
export type ChangeKind = "added" | "removed" | "changed";

export interface ReviewChange {
  path: string;
  kind: ChangeKind;
  before?: unknown;
  after?: unknown;
  destructive?: boolean;
  reason?: string;
}

export interface DestructiveItem {
  type: string;
  ids: string[];
  responseCount?: number;
  removes: string;
  detail: string;
}

export interface DocumentReview {
  kind: DocumentKind;
  id: string;
  name: string;
  workspaceId: string;
  status: ReviewStatus;
  updatedAt: string;
  expectedUpdatedAt: string;
  detail?: string;
  summary: { total: number; added: number; removed: number; changed: number; destructive: number };
  changes: ReviewChange[];
  omittedChanges: number;
  destructive: DestructiveItem[];
  issues: { name: string; reason: string }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isChange = (value: unknown): value is ReviewChange =>
  isRecord(value) &&
  isString(value.path) &&
  (value.kind === "added" || value.kind === "removed" || value.kind === "changed");

const isDestructiveItem = (value: unknown): value is DestructiveItem =>
  isRecord(value) &&
  isString(value.type) &&
  Array.isArray(value.ids) &&
  isString(value.removes) &&
  isString(value.detail);

const isIssue = (value: unknown): value is { name: string; reason: string } =>
  isRecord(value) && isString(value.name) && isString(value.reason);

const KINDS: readonly string[] = ["survey", "creative", "workflow"];
const STATUSES: readonly string[] = ["valid", "stale", "destructive", "invalid"];

/**
 * The review in a tool result, or `undefined` when the result is not one (an error result, a host that
 * dropped `structuredContent`). Checked field by field: the view renders what it is given, so a shape it
 * does not recognise must fall back to the text rather than crash.
 */
export const readReview = (result: ToolResult | null | undefined): DocumentReview | undefined => {
  if (!result || result.isError) return undefined;
  const data = result.structuredContent?.data;
  if (!isRecord(data) || !isRecord(data.summary)) return undefined;
  const { summary } = data;

  if (
    !isString(data.kind) ||
    !KINDS.includes(data.kind) ||
    !isString(data.status) ||
    !STATUSES.includes(data.status) ||
    !isString(data.id) ||
    !isString(data.name) ||
    !isString(data.workspaceId) ||
    !isString(data.updatedAt) ||
    !isString(data.expectedUpdatedAt) ||
    !Array.isArray(data.changes) ||
    !Array.isArray(data.destructive) ||
    !Array.isArray(data.issues) ||
    !isCount(summary.total) ||
    !isCount(summary.added) ||
    !isCount(summary.removed) ||
    !isCount(summary.changed) ||
    !isCount(summary.destructive)
  ) {
    return undefined;
  }

  return {
    kind: data.kind as DocumentKind,
    id: data.id,
    name: data.name,
    workspaceId: data.workspaceId,
    status: data.status as ReviewStatus,
    updatedAt: data.updatedAt,
    expectedUpdatedAt: data.expectedUpdatedAt,
    ...(isString(data.detail) && { detail: data.detail }),
    summary: {
      total: summary.total,
      added: summary.added,
      removed: summary.removed,
      changed: summary.changed,
      destructive: summary.destructive,
    },
    changes: data.changes.filter(isChange),
    omittedChanges: isCount(data.omittedChanges) ? data.omittedChanges : 0,
    destructive: data.destructive.filter(isDestructiveItem),
    issues: data.issues.filter(isIssue),
  };
};

export type PushArguments = {
  kind: DocumentKind;
  id: string;
  schemaVersion: number;
  expectedUpdatedAt: string;
  document: Record<string, unknown>;
  confirmDestructive?: true;
};

export type ReviewedArguments = { ok: true; args: PushArguments } | { ok: false; reason: string };

/**
 * The arguments the review was made for, taken from what the host sent as the tool input. Only the five
 * fields a review takes are kept (so a stray `dryRun` or `confirmDestructive` the model sent never rides
 * along), and they must be the ones the result is about: if the id, kind or `expectedUpdatedAt` differ,
 * approving could push something other than what is on screen, so approval is refused instead.
 */
export const getReviewedArguments = (
  input: Record<string, unknown> | null,
  review: DocumentReview
): ReviewedArguments => {
  if (!input) return { ok: false, reason: "The request this review belongs to has not arrived yet." };

  const { kind, id, schemaVersion, expectedUpdatedAt, document } = input;
  if (
    !isString(kind) ||
    !KINDS.includes(kind) ||
    !isString(id) ||
    !isCount(schemaVersion) ||
    !isString(expectedUpdatedAt) ||
    !isRecord(document)
  ) {
    return { ok: false, reason: "The host did not pass on the arguments this review was made for." };
  }
  if (kind !== review.kind || id !== review.id || expectedUpdatedAt !== review.expectedUpdatedAt) {
    return { ok: false, reason: "The arguments the host passed on are not the ones this review shows." };
  }

  return { ok: true, args: { kind, id, schemaVersion, expectedUpdatedAt, document } };
};

/** The push approval sends: the reviewed arguments, plus `confirmDestructive` only when the box was ticked. */
export const buildPushArguments = (args: PushArguments, confirmed: boolean): PushArguments => {
  const { confirmDestructive: _dropped, ...reviewed } = args;
  return confirmed ? { ...reviewed, confirmDestructive: true } : reviewed;
};

export type ApprovalBlock = "nothing" | "stale" | "invalid" | "confirm" | "arguments" | undefined;

/** Why approval is unavailable right now, or `undefined` when the person may approve. */
export const getApprovalBlock = (
  review: DocumentReview,
  reviewed: ReviewedArguments,
  confirmed: boolean
): ApprovalBlock => {
  if (review.status === "stale") return "stale";
  if (review.status === "invalid") return "invalid";
  if (review.summary.total === 0) return "nothing";
  if (!reviewed.ok) return "arguments";
  if (review.status === "destructive" && !confirmed) return "confirm";
  return undefined;
};

export const joinWithAnd = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** The label of the box that gates a destructive approval: "I understand this removes …". */
export const getConfirmLabel = (review: DocumentReview): string => {
  const removes = review.destructive.map((item) => item.removes);
  return removes.length > 0
    ? `I understand this removes ${joinWithAnd(removes)}.`
    : "I understand this removes data.";
};

const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  survey: "survey",
  creative: "creative",
  workflow: "workflow",
};

export const getDocumentLabel = (kind: DocumentKind): string => DOCUMENT_LABEL[kind];

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** `welcomeCard` to "Welcome card". */
export const humanizeSegment = (segment: string): string => {
  const words = segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return capitalize(words);
};

const topLevelKey = (path: string): string => /^[^.[\]]+/.exec(path)?.[0] ?? path;

export interface ChangeGroup {
  key: string;
  label: string;
  changes: ReviewChange[];
}

/** The changes grouped by the top-level field they belong to, in the order the fields first appear. */
export const groupChanges = (changes: ReviewChange[]): ChangeGroup[] => {
  const groups = new Map<string, ChangeGroup>();
  for (const change of changes) {
    const key = topLevelKey(change.path);
    const group = groups.get(key) ?? { key, label: humanizeSegment(key), changes: [] };
    group.changes.push(change);
    groups.set(key, group);
  }
  return [...groups.values()];
};

/** A before or after value as plain text. Strings show as they are, anything else as JSON. */
export const describeValue = (value: unknown): string => {
  if (value === undefined) return "";
  if (typeof value === "string") return value === "" ? "(empty text)" : value;
  return JSON.stringify(value, null, 2);
};

const COLLAPSE_CHARACTERS = 160;
const COLLAPSE_LINES = 4;

/** A value long enough to be collapsed behind "Show more". */
export const isLongValue = (text: string): boolean =>
  text.length > COLLAPSE_CHARACTERS || text.split("\n").length > COLLAPSE_LINES;

/** A timestamp in the host's locale and time zone; the raw text when it cannot be formatted. */
export const formatTimestamp = (iso: string, locale?: string, timeZone?: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(
      date
    );
  } catch {
    return iso;
  }
};

export const formatCount = (value: number, locale?: string): string => {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
};

export type ApplyOutcome =
  | { ok: true; updatedAt: string; changeCount: number }
  | {
      ok: false;
      /** The push was refused because the document changed since it was pulled. */
      stale: boolean;
      title: string;
      detail: string;
      issues: { name: string; reason: string }[];
      requestId?: string;
    };

/**
 * What `push_document` answered. A success is a result whose data says the push was a real write and
 * names the stored document; everything else is a failure with the server's own words. A push that
 * answers `ok` but wrote nothing (a dry run, an unexpected body) is not reported as applied.
 */
export const readApplyOutcome = (result: ToolResult | null | undefined): ApplyOutcome => {
  const structured = result?.structuredContent;
  const data = structured?.data;

  if (result && !result.isError && isRecord(data) && data.dryRun === false && isRecord(data.envelope)) {
    const { updatedAt } = data.envelope;
    if (isString(updatedAt)) {
      return {
        ok: true,
        updatedAt,
        changeCount: Array.isArray(data.changes) ? data.changes.length : 0,
      };
    }
  }

  const error = structured?.error;
  if (isRecord(error)) {
    const details = isRecord(error.details) ? error.details : {};
    return {
      ok: false,
      stale: error.status === 409 && isString(details.currentUpdatedAt),
      title: isString(error.title) ? error.title : "The push failed",
      detail: isString(error.detail) ? error.detail : "The server refused the change.",
      issues: Array.isArray(error.invalid_params) ? error.invalid_params.filter(isIssue) : [],
      ...(isString(error.requestId) && { requestId: error.requestId }),
    };
  }

  const text = result?.content?.find((block) => block.type === "text")?.text;
  return {
    ok: false,
    stale: false,
    title: "The push failed",
    detail: result?.isError && text ? text : "The server did not confirm that the change was applied.",
    issues: [],
  };
};

/** The note the model gets once the person has decided, so its next turn starts from what happened. */
export const buildOutcomeNote = (review: DocumentReview, outcome: ApplyOutcome | "declined"): string => {
  const subject = `${getDocumentLabel(review.kind)} "${review.name}" (${review.id})`;
  if (outcome === "declined") {
    return `The user reviewed the change to ${subject} and declined it. Nothing was pushed. Do not push it unless they ask you to.`;
  }
  if (outcome.ok) {
    return `The user approved the change to ${subject} in the review view and push_document applied it (${outcome.changeCount} ${outcome.changeCount === 1 ? "change" : "changes"}). The stored document's updatedAt is now ${outcome.updatedAt}; pull it again before editing further.`;
  }
  if (outcome.stale) {
    return `The user approved the change to ${subject} but the push was refused: the document changed since it was pulled. Nothing was written. Pull it again, redo the edit and review again.`;
  }
  return `The user approved the change to ${subject} but push_document refused it: ${outcome.detail.replace(/[.\s]+$/, "")}. Nothing was written.`;
};
