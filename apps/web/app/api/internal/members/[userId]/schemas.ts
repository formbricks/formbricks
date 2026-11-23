import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZMembershipUpdateInput } from "@formbricks/types/memberships";

/** `/api/internal/members/{userId}` path. */
export const ZMemberPathParams = z.object({ userId: ZId }).strict();

/** `/api/internal/members/{userId}` query: the organization whose membership is meant. */
export const ZMemberQuery = z.object({ organizationId: ZId }).strict();

/** `PATCH /api/internal/members/{userId}` body: the member's new organization role. */
export const ZMemberUpdateBody = ZMembershipUpdateInput.strict();
export type TMemberUpdateBody = z.infer<typeof ZMemberUpdateBody>;
