import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { TSsoProvisioningDecision } from "./sso-provisioning";

type SsoProvisionDecision = Extract<TSsoProvisioningDecision, { action: "provision" }>;

interface SsoRequestStore {
  /** Set by `user.create.before` (the provisioning gate), consumed by `user.create.after` (the writes). */
  provisioningDecision?: SsoProvisionDecision;
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
  if (store) store.provisioningDecision = decision;
};

export const getSsoProvisioningDecision = (): SsoProvisionDecision | undefined =>
  ssoRequestContext.getStore()?.provisioningDecision;
