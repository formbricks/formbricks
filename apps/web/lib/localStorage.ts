export const FORMBRICKS_ENVIRONMENT_ID_LS = "formbricks-environment-id";
export const FORMBRICKS_WORKSPACE_ID_LS = "formbricks-workspace-id";
export const FORMBRICKS_LOGGED_IN_WITH_LS = "formbricks-logged-in-with";

/**
 * Runs `access` against localStorage, or returns `fallback` when the browser withholds it.
 *
 * `typeof window !== "undefined"` only says the code runs in a browser, not that storage is
 * reachable. Safari with "Block all cookies", a sandboxed iframe or a locked-down profile either
 * leaves `localStorage` out (read through `globalThis`, that is `undefined`, not a ReferenceError)
 * or throws a `SecurityError` on reading it; a full quota throws on `setItem`. Both throws are
 * `DOMException`s. Everything kept here is a convenience (a remembered workspace, the last sign-in
 * method, a collapsed sidebar), so losing it must never take a page down. Other errors are ours
 * and propagate.
 */
const withLocalStorage = <T>(access: (storage: Storage) => T, fallback: T): T => {
  try {
    const storage: Storage | undefined = globalThis.localStorage;
    return storage ? access(storage) : fallback;
  } catch (error) {
    if (error instanceof DOMException) return fallback;
    throw error;
  }
};

/** The stored value, or null when there is none or storage is unavailable. */
export const readLocalStorage = (key: string): string | null =>
  withLocalStorage((storage) => storage.getItem(key), null);

/** Stores the value; does nothing when storage is unavailable. */
export const writeLocalStorage = (key: string, value: string): void =>
  withLocalStorage((storage) => storage.setItem(key, value), undefined);

/** Removes the value; does nothing when storage is unavailable. */
export const removeLocalStorage = (key: string): void =>
  withLocalStorage((storage) => storage.removeItem(key), undefined);

// Server-readable mirror of the "last active workspace". The proxy sets this from the
// /workspaces/[workspaceId] path so server components (e.g. the workspace-agnostic org-settings
// shell) can resolve the current workspace during render — localStorage is browser-only.
export const FORMBRICKS_WORKSPACE_ID_COOKIE = "formbricks-workspace-id";

// Server-readable "last active organization", set by the proxy from /organizations/[organizationId]
// paths and cleared again on any /workspaces/[workspaceId] visit. It only exists while the most recent
// org-scoped visit is newer than the last workspace visit — e.g. an organization with no workspace
// yet (its landing page) — which is exactly when the workspace cookie above names the wrong
// organization. Account settings, which carry no organization in the URL, read it first.
export const FORMBRICKS_ORGANIZATION_ID_COOKIE = "formbricks-organization-id";
