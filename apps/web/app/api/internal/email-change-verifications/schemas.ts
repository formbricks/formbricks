import { z } from "zod";

/** `POST /api/internal/email-change-verifications`: the token from the new address's confirmation email. */
export const ZEmailChangeVerificationBody = z.object({ token: z.string().min(1) }).strict();

export type TEmailChangeVerificationBody = z.infer<typeof ZEmailChangeVerificationBody>;
