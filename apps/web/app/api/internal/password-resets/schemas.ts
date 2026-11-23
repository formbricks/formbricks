import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";
import { EMAILED_TOKEN_MAX } from "@/app/api/internal/lib/limits";

/** `POST /api/internal/password-resets`: a new password, with the token from the reset email. */
export const ZPasswordResetBody = z
  .object({ token: z.string().min(1).max(EMAILED_TOKEN_MAX), password: ZUserPassword })
  .strict();

export type TPasswordResetBody = z.infer<typeof ZPasswordResetBody>;
