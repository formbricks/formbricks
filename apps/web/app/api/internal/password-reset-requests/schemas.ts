import { z } from "zod";
import { ZUserEmail } from "@formbricks/types/user";

/** `POST /api/internal/password-reset-requests`: the address to send a reset link to. */
export const ZPasswordResetRequestBody = z.object({ email: ZUserEmail }).strict();

export type TPasswordResetRequestBody = z.infer<typeof ZPasswordResetRequestBody>;
