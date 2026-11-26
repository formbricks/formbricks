import { z } from "zod";
import { ZUserEmail } from "@formbricks/types/user";
import { MAX_CALLBACK_URL_LENGTH } from "@/lib/utils/url";

/** `POST /api/internal/verification-emails`: the address to send a new verification email to. */
export const ZVerificationEmailBody = z
  .object({
    email: ZUserEmail,
    // The same bound `getValidatedCallbackUrl` enforces, so a callback this route accepts is one the rest
    // of the app would accept too — two independent numbers here drifted once already.
    callbackUrl: z.string().max(MAX_CALLBACK_URL_LENGTH).optional(),
  })
  .strict();

export type TVerificationEmailBody = z.infer<typeof ZVerificationEmailBody>;
