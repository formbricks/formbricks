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
