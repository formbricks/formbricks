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
 * check that themselves — a valid invite is an independent grant, and a call to Better Auth's sign-up
 * endpoint from outside `createUserAction` has no invite to present.
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
export type TUninvitedSignupAdmission = "open" | "fresh-instance" | "denied";

/**
 * WHY a reason and not a boolean (ENG-2247): the fresh-instance branch is the one the bootstrap marker
 * gates, and "allowed" alone cannot tell it apart from open sign-up. Marking on plain "allowed" would
 * write the marker for every Cloud sign-up and collide on the second account ever created.
 */
export const resolveUninvitedSignupAdmission = async (): Promise<TUninvitedSignupAdmission> => {
  if (SIGNUP_ENABLED && (await getIsMultiOrgEnabled())) return "open";
  return (await getIsFreshInstance()) ? "fresh-instance" : "denied";
};

export const isUninvitedSignupAllowed = async (): Promise<boolean> =>
  (await resolveUninvitedSignupAdmission()) !== "denied";

/**
 * Better Auth's native credential sign-up endpoint. Closed over HTTP since ENG-3988 (`disabledPaths`),
 * but hooks still see it on every in-process `auth.api.signUpEmail` call.
 */
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
 * Better Auth `before` hook: enforce the closed-sign-up policy on Better Auth's `/sign-up/email` endpoint
 * BEFORE the endpoint handler runs (ENG-2293).
 *
 * ENG-2293 was the raw HTTP route: `apps/web/app/api/auth/[...all]/route.ts` mounts `auth.handler` raw,
 * so Better Auth served its own credential sign-up route beside ours, and an unauthenticated POST
 * created an account on an instance the operator had closed.
 *
 * WHY here rather than only in `databaseHooks.user.create.before`: the endpoint looks the email up
 * *before* it creates anything (`api/routes/sign-up.mjs` — `findUserByEmail`, then the
 * `shouldReturnGenericDuplicateResponse` branch returns a synthetic 200 for an address that already
 * has an account, without writing a row, so no create hook ever runs). A gate that lives in the create
 * hook is therefore only reachable for addresses that do NOT exist, and Better Auth turns a 403 from
 * that hook into the same synthetic 200 (the `statusCode === 403` branch around `createUser`), so the
 * rejection would be swallowed into a fake success the caller cannot tell from a real one. `autoSignIn:
 * false` in auth.ts makes that duplicate branch unconditional, and its comment calls the behaviour
 * "enumeration-safe" (ENG-2091 / ENG-2099). Running before the handler refuses every request
 * identically and visibly, whatever the address. Same reasoning and the same slot as
 * `hibpBreachCheckBeforeHandler`, which sits here so a reset token isn't consumed before rejection.
 *
 * Action-routed sign-ups are exempt: `createUserAction` has already applied the full policy (including
 * the invite exemption this hook cannot see) and marks the request scope before calling
 * `auth.api.signUpEmail`. The absence of that mark is what identifies a sign-up from anywhere else.
 *
 * Since ENG-3988 the HTTP route is closed in `disabledPaths`, so a raw POST gets a 404 before any hook
 * runs. This stays as defence in depth for an in-process caller other than the action.
 */
export const signupPolicyBeforeHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== CREDENTIAL_SIGNUP_PATH) return;
  // Already gated by createUserAction, which also honours a valid invite — do not re-decide it here.
  if (isSignupDomainAllowed()) return;

  if (!(await isUninvitedSignupAllowed())) {
    throw signupDisabledError();
  }
};
