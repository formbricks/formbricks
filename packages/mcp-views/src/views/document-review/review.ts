/**
 * The logic behind the change-review view, kept out of the component so it can be tested: reading the
 * tool result (the server's `ZDocumentReview` in apps/web/modules/mcp/apps/document-review/review.ts,
 * declared again here because a view cannot import from the web app), deciding whether the person may
 * approve, and building the exact arguments of the push that approval sends.
 */
import { isRecord } from "../../shared/guards";
import type { ToolResult } from "../../shared/tool-result";

const KINDS = ["survey", "creative", "workflow"] as const;
const STATUSES = ["valid", "stale", "destructive", "invalid"] as const;

export type DocumentKind = (typeof KINDS)[number];
export type ReviewStatus = (typeof STATUSES)[number];
export type ChangeKind = "added" | "removed" | "changed";

export const isDocumentKind = (value: unknown): value is DocumentKind => KINDS.some((kind) => kind === value);
const isReviewStatus = (value: unknown): value is ReviewStatus => STATUSES.some((status) => status === value);

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
  /** The `schemaVersion` of the stored document this review was made against. */
  schemaVersion: number;
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
    !isDocumentKind(data.kind) ||
    !isReviewStatus(data.status) ||
    !isString(data.id) ||
    !isString(data.name) ||
    !isString(data.workspaceId) ||
    !isCount(data.schemaVersion) ||
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
    kind: data.kind,
    id: data.id,
    name: data.name,
    workspaceId: data.workspaceId,
    schemaVersion: data.schemaVersion,
    status: data.status,
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
    !isDocumentKind(kind) ||
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

export type ApprovalBlock = "nothing" | "stale" | "invalid" | "confirm" | "arguments" | "version" | undefined;

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
  // The push carries the version the agent pulled; the review was made against the stored document's.
  // A push whose version differs would be refused, or worse, mean a different shape than the one on screen.
  if (reviewed.args.schemaVersion !== review.schemaVersion) return "version";
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

/** Why a push did not happen or did not go through. */
export type FailureReason =
  /** The push never left the view: approval was not allowed (checked again at the moment of approving). */
  | "blocked"
  /** The reviewed document version is not the one the push carries; nothing was sent. */
  | "version"
  /** The server refused: the document changed since it was pulled. */
  | "stale"
  /** The server refused for another reason (not valid, would remove data, not allowed, a fault). */
  | "refused"
  /** The host could not reach the server. */
  | "unreachable";

export type ApplyOutcome =
  | { ok: true; updatedAt: string; changeCount: number }
  | {
      ok: false;
      reason: FailureReason;
      title: string;
      detail: string;
      issues: { name: string; reason: string }[];
      requestId?: string;
      /** The HTTP status the server answered, when it said one. */
      status?: number;
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
      reason: error.status === 409 && isString(details.currentUpdatedAt) ? "stale" : "refused",
      title: isString(error.title) ? error.title : "The push failed",
      detail: isString(error.detail) ? error.detail : "The server refused the change.",
      issues: Array.isArray(error.invalid_params) ? error.invalid_params.filter(isIssue) : [],
      ...(isString(error.requestId) && { requestId: error.requestId }),
      ...(isCount(error.status) && { status: error.status }),
    };
  }

  const text = result?.content?.find((block) => block.type === "text")?.text;
  return {
    ok: false,
    reason: "refused",
    title: "The push failed",
    detail: result?.isError && text ? text : "The server did not confirm that the change was applied.",
    issues: [],
  };
};
