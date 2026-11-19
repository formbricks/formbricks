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
 *
 * An update also records the row as it was just before ({@link readConsentPreimages}), read right before
 * the write, so a failed approval puts back what it replaced, including another tab's approval that saved
 * since this request began, rather than what the request read at its start. The read and the write are two
 * statements outside any transaction (the provider's), so a write landing between them is still missed.
 */
type TConsentWrite = { id: string; updatedAt: number; preimage: TConsentPreimage | null };

/** A consent row as the provider writes it on Allow: every column its write sets, to put back. */
export type TConsentPreimage = {
  id: string;
  scopes: string[];
  resources: string[];
  requestedUserInfoClaims: string[];
  updatedAt: Date;
};

const CONSENT_MODEL = "oauthConsent";

const consentWrites = defineRequestState<TConsentWrite[]>(() => []);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const readPreimage = (row: unknown): TConsentPreimage | null => {
  if (typeof row !== "object" || row === null) return null;
  const { id, scopes, resources, requestedUserInfoClaims, updatedAt } = row as Record<string, unknown>;
  if (typeof id !== "string" || !(updatedAt instanceof Date) || !isStringArray(scopes)) return null;
  return {
    id,
    scopes,
    resources: isStringArray(resources) ? resources : [],
    requestedUserInfoClaims: isStringArray(requestedUserInfoClaims) ? requestedUserInfoClaims : [],
    updatedAt,
  };
};

const recordConsentWrite = async (row: unknown, before: unknown): Promise<void> => {
  if (typeof row !== "object" || row === null) return;
  const { id, updatedAt } = row as { id?: unknown; updatedAt?: unknown };
  if (typeof id !== "string" || !(updatedAt instanceof Date) || !(await hasRequestState())) return;
  const write = { id, updatedAt: updatedAt.getTime(), preimage: readPreimage(before) };
  await consentWrites.set([...(await consentWrites.get()), write]);
};

/**
 * Wraps the auth adapter so each consent row it creates or updates during a request is recorded for that
 * request. Every other call, and every other model, passes through untouched.
 */
export const recordOAuthConsentWrites =
  (createAdapter: (options: BetterAuthOptions) => DBAdapter) =>
  (options: BetterAuthOptions): DBAdapter => {
    const adapter = createAdapter(options);
    return new Proxy(adapter, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "create" && property !== "update") return value;
        return async (data: { model: string; where?: Parameters<typeof target.findOne>[0]["where"] }) => {
          if (data.model !== CONSENT_MODEL) return value.call(target, data);
          const before =
            property === "update" && data.where
              ? await target.findOne({ model: CONSENT_MODEL, where: data.where })
              : null;
          const row: unknown = await value.call(target, data);
          await recordConsentWrite(row, before);
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

/**
 * What this request's consent updates replaced, row by row, and the ids of the rows it created (which had
 * no row before). Empty outside a request.
 */
export const readConsentPreimages = async (): Promise<{
  replaced: ReadonlyArray<TConsentPreimage>;
  createdIds: ReadonlySet<string>;
}> => {
  const writes = (await hasRequestState()) ? await consentWrites.get() : [];
  return {
    replaced: writes.flatMap(({ preimage }) => (preimage ? [preimage] : [])),
    createdIds: new Set(writes.filter(({ preimage }) => !preimage).map(({ id }) => id)),
  };
};
