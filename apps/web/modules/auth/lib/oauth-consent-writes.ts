import "server-only";
import type { BetterAuthOptions } from "@better-auth/core";
import { defineRequestState, hasRequestState } from "@better-auth/core/context";
import type { DBAdapter } from "@better-auth/core/db/adapter";

/**
 * The consent rows this request wrote, as the provider's own writes returned them: the row's id and the
 * `updatedAt` the provider stamped on it.
 *
 * The provider writes a consent through the adapter, outside any transaction, and its endpoint returns
 * neither the row nor its id. The hooks that follow an approval or `update-consent` need to tell their own
 * write from another request's write to the same row (a second tab approving the same client rewrites the
 * row the first tab created), so the adapter records each consent write here ({@link recordOAuthConsentWrites})
 * and the hooks match a row against it ({@link readOwnConsentWriteCheck}). A later write to the row stamps a
 * later `updatedAt`, so it no longer matches; a write in the same second with the same scopes leaves an
 * identical row, which nothing can tell apart.
 */
type TConsentWrite = { id: string; updatedAt: number };

const CONSENT_MODEL = "oauthConsent";

const consentWrites = defineRequestState<TConsentWrite[]>(() => []);

const readConsentWrite = (row: unknown): TConsentWrite | null => {
  if (typeof row !== "object" || row === null) return null;
  const { id, updatedAt } = row as { id?: unknown; updatedAt?: unknown };
  return typeof id === "string" && updatedAt instanceof Date ? { id, updatedAt: updatedAt.getTime() } : null;
};

const recordConsentWrite = async (row: unknown): Promise<void> => {
  const write = readConsentWrite(row);
  if (!write || !(await hasRequestState())) return;
  await consentWrites.set([...(await consentWrites.get()), write]);
};

/**
 * Wraps the auth adapter so each consent row it creates or updates during a request is recorded for that
 * request. Every other call, and every other model, passes through untouched.
 */
export const recordOAuthConsentWrites =
  (createAdapter: (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>) =>
  (options: BetterAuthOptions): DBAdapter<BetterAuthOptions> => {
    const adapter = createAdapter(options);
    return new Proxy(adapter, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "create" && property !== "update") return value;
        return async (data: { model: string }) => {
          const row: unknown = await value.call(target, data);
          if (data.model === CONSENT_MODEL) await recordConsentWrite(row);
          return row;
        };
      },
    });
  };

/** Whether this request wrote `consent` as it stands now: its id, stamped as this request's write left it. */
export const readOwnConsentWriteCheck = async (): Promise<
  (consent: { id: string; updatedAt: Date }) => boolean
> => {
  const writes = (await hasRequestState()) ? await consentWrites.get() : [];
  return (consent) =>
    writes.some(({ id, updatedAt }) => id === consent.id && updatedAt === consent.updatedAt.getTime());
};
