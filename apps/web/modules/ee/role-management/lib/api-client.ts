import type { TInviteUpdateBody } from "@/app/api/internal/invites/schemas";
import type { TInviteRoleResource } from "@/app/api/internal/invites/serializers";
import type { TMemberUpdateBody } from "@/app/api/internal/members/[userId]/schemas";
import type { TMemberRoleResource } from "@/app/api/internal/members/[userId]/serializers";
import { buildApiUrl, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/** Change a member's role in the organization. */
export const updateMemberRole = ({
  userId,
  organizationId,
  body,
}: {
  userId: string;
  organizationId: string;
  body: TMemberUpdateBody;
}) =>
  sendApiRequest<TMemberRoleResource>(
    buildApiUrl(`/api/internal/members/${encodeURIComponent(userId)}`, { organizationId }),
    { method: "PATCH", body }
  );

/** Change the role a pending invite grants. */
export const updateInviteRole = ({ inviteId, body }: { inviteId: string; body: TInviteUpdateBody }) =>
  sendApiRequest<TInviteRoleResource>(`/api/internal/invites/${encodeURIComponent(inviteId)}`, {
    method: "PATCH",
    body,
  });
