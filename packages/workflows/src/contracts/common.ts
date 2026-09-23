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
