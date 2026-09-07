import { z } from "zod";

export const ZIsoDateTime = z.iso.datetime({ offset: true });

export const ZCursorPaginationMeta = z
  .strictObject({
    // No upper bound: this echoes the page size the server applied. `validateOutput` checks it
    // against the requested limit, so capping it here would surface an out-of-range request as a
    // 500 (WorkflowSerializationError) instead of the 400 the input schema already returns.
    limit: z.number().int().min(1),
    nextCursor: z
      .string()
      .min(1)
      .nullable()
      .describe("Opaque cursor for the next page. Null when there are no more results."),
  })
  .describe("Cursor pagination metadata returned by list operations.");
export type TCursorPaginationMeta = z.infer<typeof ZCursorPaginationMeta>;

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
