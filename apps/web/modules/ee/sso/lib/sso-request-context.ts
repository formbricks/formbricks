import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { TSsoProvisioningDecision } from "./sso-provisioning";

type SsoProvisionDecision = Extract<TSsoProvisioningDecision, { action: "provision" }>;

/** The resolved SSO identity captured in `mapProfileToUser`, for verify-before-link recovery. */
export interface PendingSsoIdentity {
  email: string;
  providerAccountId: string;
}

interface SsoRequestStore {
  /** Set by `user.create.before` (the provisioning gate), consumed by `user.create.after` (the writes). */
  provisioningDecision?: SsoProvisionDecision;
  /** Set by each provider's `mapProfileToUser`; read by the collision-detect after-hook on a
   *  no-account-linked collision to start verify-before-link recovery. */
  pendingIdentity?: PendingSsoIdentity;
  /** Marketing attribution read from the `fb_attribution` cookie in `user.create.before` (request
   *  scope), consumed by `user.create.after` for the `user_signed_up` event — the after-hook runs
   *  post-commit where re-reading the cookie is unreliable. */
  attributionProperties?: Record<string, string>;
  /** Set by `user.create.before` when an SSO sign-up is rejected (e.g. personal email domain on
   *  Cloud); read by the after-hook to redirect back to /auth/signup with a tailored error. */
  signupRejectReason?: string;
}

const ssoRequestContext = new AsyncLocalStorage<SsoRequestStore>();

/**
 * Run `fn` within a fresh SSO request scope so the Better Auth hooks can carry state across a single
 * request — the gate decision resolved in `user.create.before` is read back in `user.create.after`
 * (re-deriving it there is unsafe: `getIsFreshInstance` flips once the user exists). The `[...all]`
 * route handler wraps `auth.handler` in this at cutover (Phase 7).
 */
export const runWithSsoRequestContext = <T>(fn: () => T): T => ssoRequestContext.run({}, fn);

export const setSsoProvisioningDecision = (decision: SsoProvisionDecision): void => {
  const store = ssoRequestContext.getStore();
  if (!store) {
    // Misconfiguration: the [...all] route must wrap `auth.handler` in `runWithSsoRequestContext`.
    // Fail loud rather than silently drop the decision — otherwise `user.create.after` would skip
    // provisioning and create an SSO user with no organization membership and no error.
    throw new Error(
      "SSO request context is missing — wrap the Better Auth handler in runWithSsoRequestContext."
    );
  }
  store.provisioningDecision = decision;
};

export const getSsoProvisioningDecision = (): SsoProvisionDecision | undefined =>
  ssoRequestContext.getStore()?.provisioningDecision;

/**
 * Stash marketing attribution resolved in `user.create.before` so `user.create.after` can attach it
 * to the `user_signed_up` event. Best-effort: attribution is non-critical, so a missing request
 * context (unlike the provisioning decision) is silently ignored rather than failing loud.
 */
export const setSsoAttributionProperties = (properties: Record<string, string>): void => {
  const store = ssoRequestContext.getStore();
  if (store) store.attributionProperties = properties;
};

export const getSsoAttributionProperties = (): Record<string, string> =>
  ssoRequestContext.getStore()?.attributionProperties ?? {};

/**
 * Stash the reason an SSO sign-up was rejected in `user.create.before`, so the after-hook can turn
 * Better Auth's generic create-failure redirect into a tailored one (personal-email block →
 * /auth/signup with a toast). Best-effort: a missing request context still blocks the sign-up (the
 * gate already returned `false`); only the tailored redirect degrades to Better Auth's default.
 */
export const setSsoSignupRejectReason = (reason: string): void => {
  const store = ssoRequestContext.getStore();
  if (store) store.signupRejectReason = reason;
};

export const getSsoSignupRejectReason = (): string | undefined =>
  ssoRequestContext.getStore()?.signupRejectReason;

/**
 * Capture the resolved SSO identity (email + provider account id) during `mapProfileToUser`, so the
 * collision-detect after-hook can start verify-before-link recovery. Best-effort: if the request
 * isn't wrapped in `runWithSsoRequestContext`, the collision simply falls through to Better Auth's
 * default error redirect (the route-wrapper misconfiguration already fails loud via the provisioning
 * guard on new-user sign-ups).
 */
export const captureSsoIdentity = (identity: {
  email: string | null | undefined;
  providerAccountId: string | null | undefined;
}): void => {
  const store = ssoRequestContext.getStore();
  if (!store) return;
  // Only stash a usable identity: a provider that omits either field can't drive recovery (it would
  // fail the email lookup or link the wrong account), so let the collision fall through to Better
  // Auth's default error instead.
  if (identity.email && identity.providerAccountId) {
    store.pendingIdentity = { email: identity.email, providerAccountId: identity.providerAccountId };
  }
};

export const getPendingSsoIdentity = (): PendingSsoIdentity | undefined =>
  ssoRequestContext.getStore()?.pendingIdentity;
