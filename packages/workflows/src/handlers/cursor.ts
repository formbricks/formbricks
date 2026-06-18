import { z } from "zod";
import type { TWorkflowSortBy } from "../contracts";
import { WorkflowInvalidInputError } from "../errors";

/**
 * Opaque, sort-bound keyset cursor for the workflow list. Mirrors the survey approach
 * (`apps/web/modules/survey/list/lib/survey-page.ts`): a base64url-encoded JSON token carrying
 * `{ version, sortBy, value, id }`. The token is bound to the sort order it was issued for, so a
 * client cannot page with a cursor from a different `sortBy`. Reimplemented here (not imported)
 * to keep the package free of `apps/web` imports.
 */

const WORKFLOW_LIST_CURSOR_VERSION = 1;

const ZDateCursor = z.object({
  version: z.literal(WORKFLOW_LIST_CURSOR_VERSION),
  sortBy: z.enum(["createdAt", "updatedAt"]),
  value: z.iso.datetime({ offset: true }),
  id: z.string().min(1),
});

const ZNameCursor = z.object({
  version: z.literal(WORKFLOW_LIST_CURSOR_VERSION),
  sortBy: z.literal("name"),
  value: z.string(),
  id: z.string().min(1),
});

const ZWorkflowListCursor = z.union([ZDateCursor, ZNameCursor]);
export type TWorkflowListCursor = z.infer<typeof ZWorkflowListCursor>;

export const encodeWorkflowListCursor = (cursor: TWorkflowListCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

/** Decode + validate a cursor, asserting it was issued for the requested sort order. */
export const decodeWorkflowListCursor = (
  encodedCursor: string,
  sortBy: TWorkflowSortBy
): TWorkflowListCursor => {
  let parsed: TWorkflowListCursor;
  try {
    const decodedJson = Buffer.from(encodedCursor, "base64url").toString("utf8");
    parsed = ZWorkflowListCursor.parse(JSON.parse(decodedJson));
  } catch {
    throw new WorkflowInvalidInputError("The cursor is invalid.", [
      { name: "cursor", reason: "The cursor is invalid." },
    ]);
  }

  if (parsed.sortBy !== sortBy) {
    throw new WorkflowInvalidInputError("The cursor does not match the requested sort order.", [
      { name: "cursor", reason: "The cursor does not match the requested sort order." },
    ]);
  }

  return parsed;
};

/** Build the next-page cursor from the last row of the current page. */
export const buildNextWorkflowListCursor = (
  row: { id: string; createdAt: Date; updatedAt: Date; name: string },
  sortBy: TWorkflowSortBy
): TWorkflowListCursor => {
  switch (sortBy) {
    case "name":
      return { version: WORKFLOW_LIST_CURSOR_VERSION, sortBy, value: row.name, id: row.id };
    case "createdAt":
      return {
        version: WORKFLOW_LIST_CURSOR_VERSION,
        sortBy,
        value: row.createdAt.toISOString(),
        id: row.id,
      };
    case "updatedAt":
    default:
      return {
        version: WORKFLOW_LIST_CURSOR_VERSION,
        sortBy,
        value: row.updatedAt.toISOString(),
        id: row.id,
      };
  }
};
