import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZMcpToolError } from "../../tools/output-schemas";
import { ZMcpListResponsesInput } from "../../tools/response-schemas";

/**
 * `show_responses` takes the filters `list_responses` takes, so what the person sees is exactly what the
 * model could have listed itself. Paging is the view's business (it follows `nextCursor` through
 * `list_responses`), and the total is always requested, so neither is an argument here. `surveyId` is
 * required: the table is one survey's responses, and without it the columns would not line up.
 */
export const ZMcpShowResponsesInput = ZMcpListResponsesInput.omit({
  cursor: true,
  includeTotalCount: true,
})
  .extend({ surveyId: ZId.describe("Survey whose responses to show.") })
  .strict();
export type TMcpShowResponsesInput = z.infer<typeof ZMcpShowResponsesInput>;

const ZColumn = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
  position: z.number().int(),
});

const ZRow = z.object({
  id: z.string(),
  createdAt: z.string(),
  finished: z.boolean(),
  language: z.string().nullable(),
  tags: z.array(z.string()),
  /** Question id to a short display string, already flattened and capped. A missing key is no answer. */
  cells: z.record(z.string(), z.string()),
});

/**
 * `_meta.formbricks` of a `show_responses` result: the table's data. View-only on purpose. Hosts show
 * `structuredContent` to the model, so everything respondents or authors wrote (answers, question labels,
 * the survey name, tags) lives here, where ChatGPT hides it from the model and the view alone reads it.
 * Not part of the tool's `outputSchema`, which describes `structuredContent` only.
 */
export const ZMcpShowResponsesViewMeta = z.object({
  survey: z.object({ name: z.string().optional() }),
  columns: z.array(ZColumn),
  rows: z.array(ZRow),
});
export type TMcpShowResponsesViewMeta = z.infer<typeof ZMcpShowResponsesViewMeta>;

/**
 * `structuredContent`, which hosts show to the model: ids, the effective query, counts and the cursor,
 * never answers or any text a respondent or author wrote. Everything on the success branch is optional and `error` carries the failure, for the reason
 * `mcpToolOutput` states: one object root keeps the wire shape identical for every client era.
 */
export const ZMcpShowResponsesOutput = z
  .object({
    survey: z.object({ id: z.string() }).optional(),
    query: z
      .object({
        workspaceId: z.string(),
        surveyId: z.string(),
        limit: z.number().int(),
        sortBy: z.enum(["-createdAt", "createdAt"]),
        contactId: z.string().optional(),
        language: z.array(z.string()).optional(),
        createdAtGte: z.string().optional(),
        createdAtLte: z.string().optional(),
        finished: z.boolean().optional(),
      })
      .optional(),
    /** How many rows and questions the view has; the values themselves are in the view-only `_meta`. */
    rowCount: z.number().int().optional(),
    columnCount: z.number().int().optional(),
    nextCursor: z.string().nullable().optional(),
    total: z.object({ count: z.number().int(), relation: z.enum(["eq", "gte"]) }).optional(),
    requestId: z.string().optional(),
    error: ZMcpToolError.optional(),
  })
  .strict();
