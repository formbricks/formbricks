import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { SINGLE_USE_ID_MAX_LENGTH } from "@/lib/utils/single-use-surveys";

/** The most single-use links one request mints: the share modal's bulk download. */
export const SINGLE_USE_LINKS_MAX_COUNT = 5000;

export const ZSurveySingleUseLinksParams = z.object({ surveyId: ZId }).strict();

/**
 * How many links to mint and whether their ids are encrypted, or the one custom id to sign (unencrypted,
 * one at a time).
 */
export const ZSurveySingleUseLinksBody = z
  .object({
    isEncrypted: z.boolean(),
    count: z.number().min(1).max(SINGLE_USE_LINKS_MAX_COUNT).prefault(1),
    singleUseId: z.string().trim().min(1).max(SINGLE_USE_ID_MAX_LENGTH).optional(),
  })
  .strict()
  .refine((data) => !data.singleUseId || (!data.isEncrypted && data.count === 1), {
    message: "Custom single-use IDs can only be generated one at a time without encryption",
  });

export type TSurveySingleUseLinksBody = z.infer<typeof ZSurveySingleUseLinksBody>;
