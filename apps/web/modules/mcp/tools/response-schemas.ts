import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3ResponseListItem, ZV3ResponseResource } from "@/app/api/v3/responses/lib/resources";
import { mcpToolOutput } from "./output-schemas";

/**
 * Input and output schemas for the response tools.
 *
 * Their own file rather than `schemas.ts` for the reason `workflow-schemas.ts` is: that file already
 * carries the survey and feedback-record surfaces, and a resource's schemas are read together.
 *
 * Every schema is `.strict()`, so an argument a tool does not declare is a loud error rather than a
 * silently discarded one — see the note at the top of `schemas.ts` for why that matters on a filter.
 *
 * The output schemas are built from `ZV3ResponseResource` and `ZV3ResponseListItem` rather than
 * restated. A hand-written copy is a second contract that drifts from the serializer the first time
 * a field is added, and the drift shows up as a client trusting a schema the server stopped honouring.
 */

/** Both list-shaped tools take the same scope and filters, so the count tool cannot drift from the list. */
const responseScope = {
  workspaceId: ZId.describe("Workspace whose responses are in scope. Always required."),
  surveyId: ZId.optional().describe("Restrict to one survey."),
  contactId: ZId.optional().describe("Restrict to responses from one contact."),
  createdAtGte: z.iso
    .datetime()
    .optional()
    .describe("Only responses created at or after this ISO 8601 timestamp."),
  createdAtLte: z.iso
    .datetime()
    .optional()
    .describe("Only responses created at or before this ISO 8601 timestamp."),
  finished: z
    .boolean()
    .optional()
    .describe("Only finished or only unfinished responses. Requires surveyId or contactId."),
  language: z
    .array(z.string().min(1).max(35))
    .min(1)
    .optional()
    .describe("Only responses stored in these language codes. Requires surveyId or contactId."),
};

export const ZMcpListResponsesInput = z
  .object({
    ...responseScope,
    // Capped below the API's 250 for the reason list_surveys is: an agent's binding constraint is its
    // context window, so a larger page costs more than it saves. A response carries every answer, so
    // the ceiling is lower here than for a survey listing.
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of responses to return. Defaults to 20."),
    cursor: z
      .string()
      .min(1)
      .optional()
      .describe("Opaque pagination cursor from a previous list_responses result."),
    includeTotalCount: z
      .boolean()
      .default(false)
      .describe(
        "Include the total matching count in `meta`. Defaults to false — use count_responses when the count is what you want."
      ),
    sortBy: z.enum(["-createdAt", "createdAt"]).default("-createdAt").describe("Newest first by default."),
  })
  .strict();
export type TMcpListResponsesInput = z.infer<typeof ZMcpListResponsesInput>;

export const ZMcpCountResponsesInput = z
  .object({
    ...responseScope,
    precision: z
      .enum(["capped", "exact"])
      .default("capped")
      .describe(
        "`capped` stops counting past a ceiling and is cheap on large surveys; `exact` always counts every row."
      ),
  })
  .strict();
export type TMcpCountResponsesInput = z.infer<typeof ZMcpCountResponsesInput>;

export const ZMcpGetResponseInput = z.object({ responseId: ZId.describe("Response to read.") }).strict();
export type TMcpGetResponseInput = z.infer<typeof ZMcpGetResponseInput>;

/**
 * `confirm` is how a caller says the user already agreed.
 *
 * It exists because elicitation does not reach every client: a 2025-era connection and a headless
 * caller have no way to answer a prompt, and without an in-band form the tool would be unusable for
 * them. Declared as a normal argument rather than hidden, so a model can see that confirming is a
 * step and that skipping it is a choice.
 */
const confirmArgument = z
  .boolean()
  .optional()
  .describe(
    "Set true only when the user has already agreed to this deletion, or when your client cannot answer confirmation prompts. Omit it to be asked."
  );

export const ZMcpDeleteResponseInput = z
  .object({
    responseId: ZId.describe("Response to delete. This cannot be undone."),
    confirm: confirmArgument,
  })
  .strict();
export type TMcpDeleteResponseInput = z.infer<typeof ZMcpDeleteResponseInput>;

export const ZMcpBatchDeleteResponsesInput = z
  .object({
    workspaceId: ZId.describe("Workspace the responses belong to."),
    ids: z
      .array(ZId)
      .min(1)
      .max(100)
      // The uniqueness rule is `ZV3BatchDeleteResponsesBody`'s, and it has to be restated here
      // because this tool calls `batchDeleteV3Responses` directly rather than through the route that
      // parses that body. Without it a repeated id answers `deleted: 2` for a three-id request — the
      // unreconcilable count that schema's own comment says the rule exists to prevent — and the
      // confirmation prompt names the array length rather than the number of rows.
      .refine((ids) => new Set(ids).size === ids.length, { message: "Response ids must be unique" })
      .describe(
        "Responses to delete, at most 100 and each id at most once. Deleted in one transaction: all or none."
      ),
    confirm: confirmArgument,
  })
  .strict();
export type TMcpBatchDeleteResponsesInput = z.infer<typeof ZMcpBatchDeleteResponsesInput>;

/**
 * `data` is `unknown` on every write tool, and the operation parses it.
 *
 * Restating the create and patch bodies here would put a second copy of the v3 contract in front of
 * the model — one that has to be kept in step with `ZV3CreateResponseBody` by hand, and that answers
 * a different error when it drifts. The operation's own parse is the single gate, and its
 * `invalid_params` reach the model unchanged, which is the same answer the HTTP API gives.
 */
export const ZMcpCreateResponseInput = z
  .object({
    data: z
      .unknown()
      .describe(
        "The response to create, in the v3 `POST /api/v3/responses` body shape: `surveyId` and `finished` are required, `data` maps element ids to answers. Call validate_response first to see what the write would do."
      ),
  })
  .strict();
export type TMcpCreateResponseInput = z.infer<typeof ZMcpCreateResponseInput>;

export const ZMcpUpdateResponseInput = z
  .object({
    responseId: ZId.describe("Response to update."),
    data: z
      .unknown()
      .describe(
        "The v3 `PATCH /api/v3/responses/{responseId}` body. A provided `data` or `tags` replaces that whole value rather than merging into it."
      ),
  })
  .strict();
export type TMcpUpdateResponseInput = z.infer<typeof ZMcpUpdateResponseInput>;

export const ZMcpValidateResponseInput = z
  .discriminatedUnion("operation", [
    z
      .object({
        operation: z.literal("create"),
        data: z.unknown().describe("The create body to check."),
      })
      .strict(),
    z
      .object({
        operation: z.literal("patch"),
        responseId: ZId.describe("Response the patch would apply to."),
        data: z.unknown().describe("The patch body to check."),
      })
      .strict(),
  ])
  .describe("A create or patch payload to check without writing it.");
export type TMcpValidateResponseInput = z.infer<typeof ZMcpValidateResponseInput>;

export const ZMcpResponseOutput = mcpToolOutput(ZV3ResponseResource);
export const ZMcpResponseListOutput = mcpToolOutput(z.array(ZV3ResponseListItem));
export const ZMcpResponseCountOutput = mcpToolOutput(
  z
    .object({
      count: z.number().int(),
      /**
       * `eq` when the count is exact, `gte` when the cap was reached and `count` is a lower bound.
       *
       * Named for what the endpoint returns, not for the `precision` that was asked for — the two are
       * different things, and the first version of this schema conflated them. The SDK validates a
       * structured result against the advertised schema, so every `count_responses` call answered an
       * output-validation error instead of a count until this matched.
       */
      relation: z.enum(["eq", "gte"]),
    })
    .loose()
);
export const ZMcpResponseDeleteOutput = mcpToolOutput(z.unknown());
export const ZMcpResponseBatchDeleteOutput = mcpToolOutput(z.object({ deleted: z.number().int() }).loose());
export const ZMcpResponseValidationOutput = mcpToolOutput(
  z
    .object({
      valid: z.boolean(),
      operation: z.enum(["create", "patch"]),
      invalid_params: z.array(z.object({ name: z.string(), reason: z.string() }).loose()),
      effects: z
        .object({
          language: z.string().nullable(),
          contactId: z.string().nullable().optional(),
          displayId: z.string().nullable().optional(),
          firesPipeline: z.boolean(),
          countsTowardMeteredResponses: z.boolean(),
          quotas: z
            .array(
              z
                .object({
                  quotaId: z.string(),
                  quotaName: z.string(),
                  wouldCount: z.boolean(),
                  wouldFill: z.boolean().optional(),
                })
                .loose()
            )
            .optional(),
          tagsToApply: z.array(z.string()).optional(),
        })
        .loose()
        .optional(),
    })
    .loose()
);
