import { z } from "zod";
import { WorkflowInvalidInputError } from "../errors";

/**
 * Opaque keyset cursor for the workflow run list. The run list has a single, fixed order — newest
 * first (`createdAt desc`, `id desc` as a stable tie-breaker) — so unlike the workflow-list cursor
 * it carries no `sortBy`. The token is a base64url-encoded JSON `{ version, value, id }` where
 * `value` is the last row's `createdAt` ISO string and `id` is its id. Reimplemented here (not
 * imported from `apps/web`) to keep the package a dependency-free leaf.
 */

const WORKFLOW_RUN_LIST_CURSOR_VERSION = 1;

const ZWorkflowRunListCursor = z.object({
  version: z.literal(WORKFLOW_RUN_LIST_CURSOR_VERSION),
  value: z.iso.datetime({ offset: true }),
  id: z.string().min(1),
});
export type TWorkflowRunListCursor = z.infer<typeof ZWorkflowRunListCursor>;

export const encodeWorkflowRunListCursor = (cursor: TWorkflowRunListCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

/** Decode + validate a run-list cursor; a malformed token is a 400 (never a 500). */
export const decodeWorkflowRunListCursor = (encodedCursor: string): TWorkflowRunListCursor => {
  try {
    const decodedJson = Buffer.from(encodedCursor, "base64url").toString("utf8");
    return ZWorkflowRunListCursor.parse(JSON.parse(decodedJson));
  } catch {
    throw new WorkflowInvalidInputError("The cursor is invalid.", [
      { name: "cursor", reason: "The cursor is invalid." },
    ]);
  }
};

/** Build the next-page cursor from the last row of the current page. */
export const buildNextWorkflowRunListCursor = (row: {
  id: string;
  createdAt: Date;
}): TWorkflowRunListCursor => ({
  version: WORKFLOW_RUN_LIST_CURSOR_VERSION,
  value: row.createdAt.toISOString(),
  id: row.id,
});
