import { z } from "zod";
import {
  type TV3DocumentEnvelope,
  type TV3DocumentPushResult,
  ZV3DocumentKind,
} from "@/app/api/v3/documents/lib/envelope";
import {
  type TDestructiveChange,
  type TDestructiveSummary,
  type TDocumentChange,
  describeDestructiveChange,
  diffDocumentValues,
  limitChanges,
  markDestructiveChanges,
} from "./diff";

/**
 * What `review_document_change` answers: a diff of the stored document against the pushed one, ready to
 * render. The change-review view (`packages/mcp-views/src/views/document-review`) declares the same shape
 * and checks it at runtime, because it cannot import from here.
 */
export const ZDocumentReviewStatus = z.enum(["valid", "stale", "destructive", "invalid"]);
export type TDocumentReviewStatus = z.infer<typeof ZDocumentReviewStatus>;

const ZDocumentReviewChange = z.object({
  path: z.string(),
  kind: z.enum(["added", "removed", "changed"]),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  destructive: z.boolean().optional(),
  reason: z.string().optional(),
});

export const ZDocumentReview = z.object({
  kind: ZV3DocumentKind,
  id: z.string(),
  name: z.string(),
  workspaceId: z.string(),
  status: ZDocumentReviewStatus,
  /** The `updatedAt` the stored document had when it was reviewed. */
  updatedAt: z.string(),
  /** The `updatedAt` the push names; the push is refused unless it equals the stored one. */
  expectedUpdatedAt: z.string(),
  /** Why the push would be refused, for `stale` and `invalid`. */
  detail: z.string().optional(),
  summary: z.object({
    total: z.number().int(),
    added: z.number().int(),
    removed: z.number().int(),
    changed: z.number().int(),
    destructive: z.number().int(),
  }),
  changes: z.array(ZDocumentReviewChange),
  /** Changes counted in `summary` but not listed in `changes`. */
  omittedChanges: z.number().int(),
  destructive: z.array(
    z.object({
      type: z.string(),
      ids: z.array(z.string()),
      responseCount: z.number().int().optional(),
      removes: z.string(),
      detail: z.string(),
    })
  ),
  issues: z.array(z.object({ name: z.string(), reason: z.string() })),
});
export type TDocumentReview = z.infer<typeof ZDocumentReview>;

/** What the dry-run push answered, sorted into the four things a review can say about it. */
export type TDryRunOutcome =
  | { type: "ok"; result: TV3DocumentPushResult }
  | {
      type: "destructive";
      changes: TDestructiveChange[];
      /** The dry run repeated with the destructive check lifted, which is what carries the new document. */
      result?: TV3DocumentPushResult;
    }
  | { type: "stale"; detail: string }
  | { type: "invalid"; detail: string; issues: { name: string; reason: string }[] };

type TReviewParams = {
  kind: TV3DocumentEnvelope["kind"];
  id: string;
  expectedUpdatedAt: string;
  /** The `document` the agent wants to push. */
  proposed: Record<string, unknown>;
  /** The stored document, as pull_document answers it. */
  current: TV3DocumentEnvelope;
  outcome: TDryRunOutcome;
};

const nameOf = (current: TV3DocumentEnvelope, proposed: Record<string, unknown>): string => {
  const stored = current.document.name;
  if (typeof stored === "string" && stored.length > 0) return stored;
  const pushed = proposed.name;
  return typeof pushed === "string" && pushed.length > 0 ? pushed : `${current.kind} ${current.id}`;
};

const countKinds = (changes: TDocumentChange[], destructiveCount: number) => ({
  total: changes.length,
  added: changes.filter((change) => change.kind === "added").length,
  removed: changes.filter((change) => change.kind === "removed").length,
  changed: changes.filter((change) => change.kind === "changed").length,
  // A removal inside a removed block has no entry of its own, so the refusal's own count is a floor.
  destructive: Math.max(changes.filter((change) => change.destructive).length, destructiveCount),
});

export function buildDocumentReview({
  kind,
  id,
  expectedUpdatedAt,
  proposed,
  current,
  outcome,
}: TReviewParams): TDocumentReview {
  let status: TDocumentReviewStatus = "valid";
  let detail: string | undefined;
  let issues: { name: string; reason: string }[] = [];
  let destructive: TDestructiveSummary[] = [];
  let after: Record<string, unknown> | undefined;

  switch (outcome.type) {
    case "ok":
      after = outcome.result.envelope.document;
      break;
    case "destructive":
      status = "destructive";
      destructive = outcome.changes.map(describeDestructiveChange);
      after = outcome.result?.envelope.document ?? proposed;
      break;
    case "stale":
      // The diff below is against what is stored now, which includes the edit the agent has not seen.
      status = "stale";
      detail = outcome.detail;
      after = proposed;
      break;
    case "invalid":
      status = "invalid";
      detail = outcome.detail;
      issues = outcome.issues;
      break;
  }

  const all = after ? markDestructiveChanges(diffDocumentValues(current.document, after), destructive) : [];
  const { changes, omitted } = limitChanges(all);

  return {
    kind,
    id,
    name: nameOf(current, proposed),
    workspaceId: current.workspaceId,
    status,
    updatedAt: current.updatedAt,
    expectedUpdatedAt,
    ...(detail !== undefined && { detail }),
    summary: countKinds(all, destructive.length),
    changes,
    omittedChanges: omitted,
    destructive,
    issues,
  };
}

const MAX_TEXT_CHANGES = 12;
const MAX_TEXT_ISSUES = 5;

const joinWithAnd = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/**
 * The model's half of the result. A host that cannot render the view shows only this, so it carries
 * enough (the changed paths) for the agent to put the change in front of the person itself, and it says
 * plainly that nothing has been written and the push waits for the person.
 */
export function buildReviewText(review: TDocumentReview): string {
  const subject = `${review.kind} "${review.name}"`;
  const waiting =
    "Nothing was written. The user decides in the review view; do not call push_document until they approve there. If you cannot see the view, list these changes to the user and ask before pushing.";

  if (review.status === "stale") {
    return `Review of ${subject}: the document changed since it was pulled (expected updatedAt ${review.expectedUpdatedAt}, stored ${review.updatedAt}). It cannot be approved. Call pull_document again, redo the edit on the new document and review again. Nothing was written.`;
  }

  if (review.status === "invalid") {
    const issues = review.issues
      .slice(0, MAX_TEXT_ISSUES)
      .map((issue) => `${issue.name}: ${issue.reason}`)
      .join("; ");
    const more =
      review.issues.length > MAX_TEXT_ISSUES ? ` (and ${review.issues.length - MAX_TEXT_ISSUES} more)` : "";
    return `Review of ${subject}: the push would be refused. ${review.detail ?? "The document is not valid."}${issues ? ` Problems: ${issues}${more}.` : ""} Fix the document and review again. Nothing was written.`;
  }

  if (review.summary.total === 0) {
    return `Review of ${subject}: the document equals the stored one, so there is nothing to approve or push. Nothing was written.`;
  }

  const { added, removed, changed, destructive } = review.summary;
  const counts = `${review.summary.total} ${review.summary.total === 1 ? "change" : "changes"} (${added} added, ${removed} removed, ${changed} changed), ${destructive} destructive`;
  const listed = review.changes
    .slice(0, MAX_TEXT_CHANGES)
    .map((change) => `${change.kind} ${change.path}${change.destructive ? " (destructive)" : ""}`);
  const rest = review.summary.total - listed.length;
  const paths = `${listed.join("; ")}${rest > 0 ? `; and ${rest} more` : ""}`;

  const removal =
    review.status === "destructive"
      ? ` The push removes data: ${joinWithAnd(review.destructive.map((item) => item.removes))}. The user must tick the confirmation in the view before it can be applied.`
      : "";

  return `Review of ${subject}: ${counts}. Changes: ${paths}.${removal} ${waiting}`;
}
