import type { TInviteBatchBody, TInviteCreateBody } from "@/app/api/internal/invites/schemas";
import type {
  TCreatedInviteResource,
  TInviteShareLinkResource,
} from "@/app/api/internal/invites/serializers";
import { buildApiUrl, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import type { TBulkInviteResult } from "./invite-failure";

/**
 * The members page's writes to `/api/internal/invites` and `/api/internal/members`. Each throws a
 * `V3ApiError` on a refusal, with the server's reason (the user-management floor, the owner rules, an
 * existing invite) as its message. Writes that send an invite email take no client timeout: the email is
 * sent before the route answers, and aborting would report a failure for an invite that was sent.
 */

const invitePath = (inviteId: string, resource?: string) => {
  const path = `/api/internal/invites/${encodeURIComponent(inviteId)}`;
  return resource ? `${path}/${resource}` : path;
};

/** Invite one person; answers the new invite's id. */
export const inviteMember = ({ organizationId, body }: { organizationId: string; body: TInviteCreateBody }) =>
  sendApiRequest<TCreatedInviteResource>(buildApiUrl("/api/internal/invites", { organizationId }), {
    method: "POST",
    body,
    timeoutMs: null,
  });

/** Invite the rows of a CSV bulk import; answers each row's outcome. */
export const inviteMembers = ({ organizationId, body }: { organizationId: string; body: TInviteBatchBody }) =>
  sendApiRequest<TBulkInviteResult[]>(buildApiUrl("/api/internal/invites/batches", { organizationId }), {
    method: "POST",
    body,
    timeoutMs: null,
  });

/** Withdraw a pending invite. */
export const deleteInvite = (inviteId: string) =>
  sendApiRequest<void>(invitePath(inviteId), { method: "DELETE" });

/** A fresh link to a pending invite, to share by hand; the invite's seven days restart. */
export const createInviteShareLink = (inviteId: string) =>
  sendApiRequest<TInviteShareLinkResource>(invitePath(inviteId, "share-links"), { method: "POST" });

/** Send a pending invite's email again; the invite's seven days restart. */
export const resendInvite = ({ inviteId, organizationId }: { inviteId: string; organizationId: string }) =>
  sendApiRequest<void>(buildApiUrl(invitePath(inviteId, "emails"), { organizationId }), {
    method: "POST",
    timeoutMs: null,
  });

/** Remove a member from the organization. */
export const deleteMember = ({ userId, organizationId }: { userId: string; organizationId: string }) =>
  sendApiRequest<void>(
    buildApiUrl(`/api/internal/members/${encodeURIComponent(userId)}`, { organizationId }),
    { method: "DELETE" }
  );

/** Leave the organization: remove the caller's own membership. */
export const leaveOrganization = (organizationId: string) =>
  sendApiRequest<void>(buildApiUrl("/api/internal/members/me", { organizationId }), { method: "DELETE" });
