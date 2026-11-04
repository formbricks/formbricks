import { z } from "zod";
import { EMAILED_TOKEN_MAX } from "@/app/api/internal/lib/limits";

/** `POST /api/internal/email-change-verifications`: the token from the new address's confirmation email. */
export const ZEmailChangeVerificationBody = z
  .object({ token: z.string().min(1).max(EMAILED_TOKEN_MAX) })
  .strict();

export type TEmailChangeVerificationBody = z.infer<typeof ZEmailChangeVerificationBody>;
