import { assertCan, can } from "@/lib/authorization";

/**
 * The capability required on the onboarding invite path (ENG-2169).
 *
 * Deliberately narrower than the org settings invite path, where managers may invite members: this
 * path takes no role input and `inviteUser` always persists an owner invite, so admitting a manager
 * here lets them mint an owner without an existing owner's approval. Nothing legitimate is lost —
 * the only entry to this screen is the redirect right after `createOrganizationAction`, which makes
 * the creator an owner.
 *
 * `organization.write` is the vocabulary's owner-only capability (`permission write: user = owner`
 * in the schema). Naming it here rather than a role list is what keeps the page gate and the action
 * gate the same question: both now ask the central interface, so neither can drift from the other
 * or from the schema.
 *
 * ENG-2409: this replaced a `SETUP_INVITE_ROLES = ["owner"]` list that the page tested by reading a
 * membership row and the action tested through the deprecated action-client adapter. The adapter
 * already mapped the role set `["owner"]` onto `organization.write`, so the action's decision is
 * unchanged; what changed is that the page's decision now goes through `can()` too, which is what
 * makes it visible to AuthZed shadow comparison instead of silently legacy-only.
 */
export const SETUP_INVITE_ACTION = "organization.write" as const;

/** Throws `AuthorizationError` unless the user may invite through the onboarding path. */
export const checkSetupInviteAuthorization = async (
  userId: string,
  organizationId: string
): Promise<void> => {
  await assertCan({ type: "user", id: userId }, SETUP_INVITE_ACTION, {
    type: "organization",
    id: organizationId,
  });
};

/** Non-throwing variant for the page gate, which renders a 404 instead of surfacing an error. */
export const hasSetupInviteAccess = async (userId: string, organizationId: string): Promise<boolean> =>
  can({ type: "user", id: userId }, SETUP_INVITE_ACTION, { type: "organization", id: organizationId });
