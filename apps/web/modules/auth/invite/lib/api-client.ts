import type { TInviteAcceptanceResource } from "@/app/api/internal/invites/acceptances/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * Accept the invite behind an invite link as the signed-in user. Throws a `V3ApiError` on a refusal: 403 for
 * a token or invite that is no longer valid for this user, 422 (`invite_expired`), 409 (`already_member`).
 * No timeout: it emails the inviter before answering.
 */
export const acceptInvite = (token: string) =>
  sendApiRequest<TInviteAcceptanceResource>("/api/internal/invites/acceptances", {
    method: "POST",
    body: { token },
    timeoutMs: null,
  });
