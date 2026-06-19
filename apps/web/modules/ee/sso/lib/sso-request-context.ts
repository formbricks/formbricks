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
 * Capture the resolved SSO identity (email + provider account id) during `mapProfileToUser`, so the
 * collision-detect after-hook can start verify-before-link recovery. Best-effort: if the request
 * isn't wrapped in `runWithSsoRequestContext`, the collision simply falls through to Better Auth's
 * default error redirect (the route-wrapper misconfiguration already fails loud via the provisioning
 * guard on new-user sign-ups).
 */
export const captureSsoIdentity = (identity: PendingSsoIdentity): void => {
  const store = ssoRequestContext.getStore();
  if (store) store.pendingIdentity = identity;
};

export const getPendingSsoIdentity = (): PendingSsoIdentity | undefined =>
  ssoRequestContext.getStore()?.pendingIdentity;
