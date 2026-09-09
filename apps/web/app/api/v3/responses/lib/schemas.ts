import { z } from "zod";

/**
 * The response id is a path parameter, so it is validated here rather than trusted: an unparseable id
 * must answer 400 before any query runs, not 500 from Prisma (ENG-483 is that bug on the v1 route).
 */
export const ZV3ResponseIdParams = z
  .object({
    responseId: z.cuid2(),
  })
  .strict();

export type TV3ResponseIdParams = z.infer<typeof ZV3ResponseIdParams>;

/**
 * `POST /api/v3/responses/batch-delete`.
 *
 * The cap and the uniqueness rule are the contract's, and both are enforced here rather than left to
 * the service: an oversized batch must answer 400 before it reaches a `deleteMany`, and duplicates
 * would make `deleted` unreconcilable against `ids.length` for no benefit to the caller.
 */
export const ZV3BatchDeleteResponsesQuery = z
  .object({
    workspaceId: z.cuid2(),
  })
  .strict();

export type TV3BatchDeleteResponsesQuery = z.infer<typeof ZV3BatchDeleteResponsesQuery>;

export const ZV3BatchDeleteResponsesBody = z
  .object({
    ids: z
      .array(z.cuid2())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Response ids must be unique",
      }),
  })
  .strict();

export type TV3BatchDeleteResponsesBody = z.infer<typeof ZV3BatchDeleteResponsesBody>;
