import "server-only";
import { APIError } from "better-auth/api";
import { SIGNUP_DISABLED_ERROR_CODE } from "@formbricks/types/errors";
import { SIGNUP_ENABLED } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

/**
 * The instance's closed-sign-up policy, in ONE place (ENG-2293).
 *
 * The policy had been written out twice — in `createUserAction`'s `assertSignupPolicyAllows` and, once
 * this hole was found, again in the Better Auth hook. That duplication IS the bug class: ENG-2073 fixed
 * the action and left the framework-mounted route open, which is what ENG-2293 then had to close. Both
 * callers now share the predicate below, so a future change to the policy cannot land in one layer
 * only. ENG-2344 tracks the third caller (SSO just-in-time provisioning) still deciding on its own.
 */

/**
 * Whether an UNINVITED sign-up is allowed by instance policy. Callers that can carry an invite must
 * check that themselves — a valid invite is an independent grant, and the raw Better Auth endpoint has
 * no invite to present.
 *
 * Two legitimate ways to be allowed: public sign-up is genuinely open (Cloud / dev / E2E *and* the
 * license permits multiple organizations), or the instance is still fresh, which is the initial
 * administrator completing setup with no invite to show.
 *
 * Query cost is deliberate. `SIGNUP_ENABLED` is a derived constant
 * (`IS_FORMBRICKS_CLOUD || IS_DEVELOPMENT || E2E_TESTING`), so testing it is free — do that first and
 * only pay for a round trip that can still change the answer. On Cloud that answers the whole question
 * from the (cached) license and never counts users; on self-hosted, where the constant is always false,
 * it skips the license lookup and spends exactly one `count`. Evaluating freshness first — as the
 * original fix did — instead made every unauthenticated raw sign-up attempt run `count(*)` on `User`.
 */
export const isUninvitedSignupAllowed = async (): Promise<boolean> => {
  if (SIGNUP_ENABLED && (await getIsMultiOrgEnabled())) return true;
  return getIsFreshInstance();
};

/** Better Auth's native credential sign-up route — the one that bypasses `createUserAction`. */
const CREDENTIAL_SIGNUP_PATH = "/sign-up/email";

/**
 * The rejection for a sign-up the instance policy forbids. Shared because two layers raise it — the
 * before-hook below and the `user.create.before` backstop — and they must stay byte-identical: the
 * response is the only thing an unauthenticated caller can see, so a divergence between them would be
 * observable. The `code` is what a client localizes against; the message is display copy.
 */
export const signupDisabledError = (): APIError =>
  new APIError("FORBIDDEN", {
    message: "Signup is disabled on this instance.",
    code: SIGNUP_DISABLED_ERROR_CODE,
  });

/**
 * Better Auth `before` hook: enforce the closed-sign-up policy on `POST /api/auth/sign-up/email`
 * BEFORE the endpoint handler runs (ENG-2293).
 *
 * `apps/web/app/api/auth/[...all]/route.ts` mounts `auth.handler` raw, so Better Auth serves its own
 * credential sign-up route beside ours. `createUserAction` gates correctly but nothing forced that
 * route to, so an unauthenticated POST created an account on an instance the operator had closed.
 *
 * WHY here rather than only in `databaseHooks.user.create.before`: the route handler looks the email up
 * *before* it creates anything (`api/routes/sign-up.mjs` — `findUserByEmail`, then the
 * `shouldReturnGenericDuplicateResponse` branch returns a synthetic 200 for an address that already
 * has an account, without writing a row, so no create hook ever runs). A gate that lives in the create
 * hook is therefore only reachable for addresses that do NOT exist, which turns the rejection into an
 * account-existence oracle: 200 for a registered address, 403 for an unregistered one. `autoSignIn:
 * false` in auth.ts makes that duplicate branch unconditional, and its comment calls the behaviour
 * "enumeration-safe" — so gating in the create hook would have quietly spent a property the sign-up
 * flow works hard to hold (ENG-2091 / ENG-2099). Running before the handler rejects every request
 * identically, whatever the address. Same reasoning and the same slot as
 * `hibpBreachCheckBeforeHandler`, which sits here so a reset token isn't consumed before rejection.
 *
 * Action-routed sign-ups are exempt: `createUserAction` has already applied the full policy (including
 * the invite exemption this hook cannot see) and marks the request scope before calling
 * `auth.api.signUpEmail`. The absence of that mark is what identifies a raw POST.
 */
export const signupPolicyBeforeHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== CREDENTIAL_SIGNUP_PATH) return;
  // Already gated by createUserAction, which also honours a valid invite — do not re-decide it here.
  if (isSignupDomainAllowed()) return;

  if (!(await isUninvitedSignupAllowed())) {
    throw signupDisabledError();
  }
};
