import "server-only";
import { AuthenticationError, AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import type { TUser, TUserPersonalInfoUpdateInput, TUserUpdateInput } from "@formbricks/types/user";
import { getIsEmailUnique } from "@/app/(app)/workspaces/[workspaceId]/settings/account/profile/lib/user";
import { EMAIL_VERIFICATION_DISABLED } from "@/lib/constants";
import { verifyUserPassword } from "@/lib/user/password";
import { updateUser } from "@/lib/user/service";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { sendVerificationNewEmail } from "@/modules/email";

const buildUserUpdatePayload = (input: TUserPersonalInfoUpdateInput): TUserUpdateInput => ({
  ...(input.name && { name: input.name }),
  ...(input.locale && { locale: input.locale }),
});

/**
 * Refuse a name change for an SSO user, mirroring the identical guard the email change applies.
 *
 * The identity provider owns `User.name` — it is re-read on every sign-in (`overrideUserInfo` in
 * modules/ee/sso/lib/better-auth-providers.ts) — so the profile form renders the input disabled. That is
 * presentation, not enforcement: the request carries `name` straight from the client, so a crafted call
 * would land a write that sticks until the next sign-in silently reverts it. Enforce it here instead.
 *
 * Only a *differing* name is refused: a client that echoes the current value back asks for no change.
 */
const assertNameUpdateAllowed = (user: TUser, input: TUserPersonalInfoUpdateInput): void => {
  const inputName = input.name?.trim();
  if (!inputName || inputName === user.name) return;
  if (user.identityProvider !== "email") {
    throw new OperationNotAllowedError("Name update is not allowed for non-credential users.");
  }
};

/**
 * A changed address needs the current password, is rate limited, and is never confirmed or denied for an
 * address someone else already uses (that would let anyone test which addresses have accounts). With email
 * verification on, the change only happens once the new address confirms it.
 */
const applyEmailChange = async (
  user: TUser,
  input: TUserPersonalInfoUpdateInput,
  payload: TUserUpdateInput
): Promise<TUserUpdateInput> => {
  const inputEmail = input.email?.trim().toLowerCase();
  if (!inputEmail || user.email === inputEmail) return payload;

  await applyRateLimit(rateLimitConfigs.actions.emailUpdate, user.id);

  if (user.identityProvider !== "email") {
    throw new OperationNotAllowedError("Email update is not allowed for non-credential users.");
  }
  if (!input.password) {
    throw new AuthenticationError("Password is required to update email.");
  }
  if (!(await verifyUserPassword(user.id, input.password))) {
    throw new AuthorizationError("Incorrect credentials");
  }
  if (!(await getIsEmailUnique(inputEmail))) return payload;

  if (EMAIL_VERIFICATION_DISABLED) {
    await updateBrevoCustomer({ id: user.id, email: inputEmail });
    return { ...payload, email: inputEmail };
  }
  await sendVerificationNewEmail(user.id, inputEmail, user.locale);
  return payload;
};

/** Update the signed-in user's own name, locale and email. Returns the user as stored afterwards. */
export const updateOwnProfile = async (user: TUser, input: TUserPersonalInfoUpdateInput): Promise<TUser> => {
  assertNameUpdateAllowed(user, input);
  const payload = await applyEmailChange(user, input, buildUserUpdatePayload(input));
  return Object.keys(payload).length > 0 ? await updateUser(user.id, payload) : user;
};
