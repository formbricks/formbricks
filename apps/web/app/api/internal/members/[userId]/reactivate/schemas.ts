import { z } from "zod";

/** `POST /api/internal/members/{userId}/reactivate` path. */
export const ZReactivateMemberPathParams = z.object({ userId: z.cuid2() }).strict();

/** `POST /api/internal/members/{userId}/reactivate` query: the organisation they are reactivated in. */
export const ZReactivateMemberQuery = z.object({ organizationId: z.cuid2() }).strict();
