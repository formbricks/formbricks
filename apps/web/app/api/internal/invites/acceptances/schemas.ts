import { z } from "zod";
import { EMAILED_TOKEN_MAX } from "@/app/api/internal/lib/limits";

/** `POST /api/internal/invites/acceptances`: the token from the invite email's link. */
export const ZInviteAcceptanceBody = z.object({ token: z.string().min(1).max(EMAILED_TOKEN_MAX) }).strict();

export type TInviteAcceptanceBody = z.infer<typeof ZInviteAcceptanceBody>;
