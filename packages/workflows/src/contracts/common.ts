import { z } from "zod";

export const ZIsoDateTime = z.iso.datetime({ offset: true });

export const ZCursorPaginationMeta = z
  .strictObject({
    // No `.max()`, matching `ListPaginationMeta` in the v3 contract: this is an echo of the page size
    // the server applied, not a bound on what may be requested. The request bound lives on the input
    // schemas in `inputs.ts`.
    //
    // It is also the half of the coupling that has to move first. `validateOutput` runs this schema
    // over the echoed `meta.limit` and turns a failure into a `WorkflowSerializationError` — a logged
    // 500. While the echo was capped at 100, raising the input cap without touching this line would
    // have turned a request for 101 into that 500 instead of the 400 the input schema already gives.
    limit: z.number().int().min(1),
    nextCursor: z
      .string()
      .min(1)
      .nullable()
      .describe("Opaque cursor for the next page. Null when there are no more results."),
  })
  .describe("Cursor pagination metadata returned by list operations.");
export type TCursorPaginationMeta = z.infer<typeof ZCursorPaginationMeta>;

/**
 * The workflow list's `meta`: the cursor pagination above plus `totalCount`, which is `null` unless the
 * caller sent `includeTotalCount=true`. Required-but-nullable, like every other counted v3 list, so a
 * client never has to tell "not asked for" from "missing".
 */
export const ZWorkflowListPaginationMeta = ZCursorPaginationMeta.extend({
  totalCount: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe("Workflows matching the current filters across all pages. Null unless includeTotalCount=true."),
}).describe("Pagination metadata for the workflow list.");
export type TWorkflowListPaginationMeta = z.infer<typeof ZWorkflowListPaginationMeta>;

export const zWorkflowListPage = <TItem extends z.ZodType>(
  item: TItem
): z.ZodObject<{ data: z.ZodArray<TItem>; meta: typeof ZWorkflowListPaginationMeta }> =>
  z.object({
    data: z.array(item),
    meta: ZWorkflowListPaginationMeta,
  });
export interface TWorkflowListPage<TItem> {
  data: TItem[];
  meta: TWorkflowListPaginationMeta;
}

export const zCursorPage = <TItem extends z.ZodType>(
  item: TItem
): z.ZodObject<{ data: z.ZodArray<TItem>; meta: typeof ZCursorPaginationMeta }> =>
  z.object({
    data: z.array(item),
    meta: ZCursorPaginationMeta,
  });
export interface TCursorPage<TItem> {
  data: TItem[];
  meta: TCursorPaginationMeta;
}

export const ZWorkflowIdInput = z
  .strictObject({
    workflowId: z.cuid2(),
  })
  .describe("Identifies one workflow. Unknown or inaccessible ids are rejected as forbidden.");
export type TWorkflowIdInput = z.infer<typeof ZWorkflowIdInput>;

export const ZWorkflowRunIdInput = z
  .strictObject({
    runId: z.cuid2(),
  })
  .describe("Identifies one workflow run by globally unique id.");
export type TWorkflowRunIdInput = z.infer<typeof ZWorkflowRunIdInput>;
