import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";

/** `POST /api/internal/password-resets`: a new password, with the token from the reset email. */
export const ZPasswordResetBody = z.object({ token: z.string().min(1), password: ZUserPassword }).strict();

export type TPasswordResetBody = z.infer<typeof ZPasswordResetBody>;
