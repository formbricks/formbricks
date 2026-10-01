import "server-only";
import type { DBAdapter, DBAdapterInstance, DBTransactionAdapter, Where } from "@better-auth/core/db/adapter";
import { AUDIT_LOG_ENABLED } from "@/lib/constants";
import { type AuthMutation, nativeAuthAuditContext } from "./native-auth-audit-context";

// Field NAMES only; values are allowed exclusively for security-policy booleans below.
// Expiry refreshes, login timestamps, identity denormalization and 2FA retry counters are bookkeeping.
const fieldsByModel: Record<string, readonly string[]> = {
  user: ["name", "email", "emailVerified", "twoFactorEnabled", "image"],
  account: ["password", "providerId", "accountId"],
  session: ["expiresAt"],
  twoFactor: ["secret", "backupCodes", "verified"],
  oauthClient: [
    "name",
    "uri",
    "icon",
    "contacts",
    "tos",
    "policy",
    "scopes",
    "redirectUris",
    "disabled",
    "clientSecret",
    "clientSecretExpiresAt",
    "grantTypes",
    "responseTypes",
    "tokenEndpointAuthMethod",
    "requirePKCE",
    "skipConsent",
    "enableEndSession",
    "postLogoutRedirectUris",
    "clientCredentialsScopes",
    "metadata",
    "softwareId",
    "softwareVersion",
    "softwareStatement",
    "subjectType",
    "backchannelLogoutUri",
    "backchannelLogoutSessionRequired",
    "applicationType",
    "jwks",
    "jwksUri",
    "dpopBoundAccessTokens",
    "referenceId",
    "userId",
  ],
  oauthConsent: ["scopes", "resources"],
  oauthAccessToken: ["scopes", "expiresAt"],
  oauthRefreshToken: ["scopes", "expiresAt", "revoked"],
  oauthResource: ["disabled", "allowedScopes"],
  oauthClientResource: ["clientId", "resourceId"],
};

type Row = Record<string, unknown>;
const row = (value: unknown): Row | undefined =>
  value && typeof value === "object" ? (value as Row) : undefined;

const recordMutation = (model: string, operation: AuthMutation["operation"], before?: Row, after?: Row) => {
  const context = nativeAuthAuditContext.getStore();
  const value = after ?? before;
  if (!context || !value || typeof value.id !== "string") return;
  const fields = (fieldsByModel[model] ?? []).filter((key) =>
    operation === "update"
      ? JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])
      : value[key] !== undefined
  );
  if (operation === "update" && fields.length === 0) return;
  const flags: NonNullable<AuthMutation["flags"]> = {};
  for (const key of ["emailVerified", "twoFactorEnabled", "verified", "disabled", "revoked"]) {
    if (fields.includes(key) && typeof after?.[key] === "boolean") {
      flags[key] = {
        before: typeof before?.[key] === "boolean" ? before[key] : undefined,
        after: after[key],
      };
    }
  }
  context.mutations.push({
    model,
    id: value.id,
    operation,
    fields,
    ...(typeof value.userId === "string" ? { subjectId: value.userId } : {}),
    ...(typeof value.clientId === "string" ? { clientId: value.clientId } : {}),
    ...(Object.keys(flags).length ? { flags } : {}),
  });
};

// All native deletions on these selectors name at most one row. consumeOne has the same
// deletion semantics but returns the row actually removed (null for concurrent/no-op deletion).
const uniqueDeleteFields: Record<string, readonly string[]> = {
  user: ["id", "email"],
  account: ["id"],
  session: ["id", "token"],
  twoFactor: ["id", "userId"],
  oauthClient: ["id", "clientId"],
  oauthConsent: ["id"],
  oauthAccessToken: ["id", "token"],
  oauthRefreshToken: ["id", "token"],
  oauthResource: ["id", "identifier"],
  oauthClientResource: ["id"],
};
const isUniqueDelete = (model: string, where: Where[] = []) =>
  where.every((clause) => clause.connector !== "OR") &&
  where.some(
    (clause) =>
      (clause.operator === undefined || clause.operator === "eq") &&
      typeof clause.value === "string" &&
      uniqueDeleteFields[model]?.includes(clause.field)
  );

const mutations = new Set([
  "create",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "consumeOne",
  "incrementOne",
]);

/** Observe the configured adapter, including OAuth plugin writes which bypass databaseHooks.
 * Reads used solely for audit are fail-open. When the underlying adapter uses real transactions,
 * set transactional=true to publish its journal only after commit (Prisma currently defaults false).
 */
const wrapAdapter = <T extends DBTransactionAdapter>(adapter: T): T =>
  new Proxy(adapter, {
    get(target, property, receiver) {
      const method = Reflect.get(target, property, receiver);
      if (typeof method !== "function" || (!mutations.has(String(property)) && property !== "findOne"))
        return method;
      return new Proxy(method, {
        async apply(fn, thisArg, args: unknown[]) {
          const context = nativeAuthAuditContext.getStore();
          const query = args[0] as { model: string; where?: Where[] };
          if (!AUDIT_LOG_ENABLED || !context || !fieldsByModel[query.model]) {
            return Reflect.apply(fn, thisArg, args);
          }
          if (property === "findOne") {
            const result = await Reflect.apply(fn, thisArg, args);
            const found = row(result);
            if (query.model === "oauthClient" && typeof found?.clientId === "string")
              context.oauthClientId = found.clientId;
            if (found && typeof found.id === "string" && context.targetModels.includes(query.model)) {
              context.target = { type: context.target!.type, id: found.id };
            }
            return result;
          }
          if (property === "delete" && isUniqueDelete(query.model, query.where)) {
            let deleted: unknown;
            try {
              deleted = await adapter.consumeOne({ model: query.model, where: query.where ?? [] });
            } catch (error) {
              context.mutationFailed = true;
              throw error;
            }
            try {
              recordMutation(query.model, "delete", row(deleted));
            } catch {
              context.observationIncomplete = true;
            }
            return undefined;
          }
          let before: Row[] = [];
          if (property !== "create") {
            try {
              // Single-row writes must never claim every row matching a non-unique predicate.
              if (["update", "delete", "incrementOne"].includes(String(property))) {
                const found = await adapter.findOne<Row>({ model: query.model, where: query.where ?? [] });
                if (found) before = [found];
              } else
                for (let offset = 0; ; offset += 100) {
                  const page = await adapter.findMany<Row>({ ...query, limit: 100, offset });
                  before.push(...page);
                  if (page.length < 100) break;
                }
            } catch {
              context.observationIncomplete = true;
            }
          }
          let result: unknown;
          try {
            result = await Reflect.apply(fn, thisArg, args);
          } catch (error) {
            context.mutationFailed = true;
            throw error;
          }
          try {
            if (property === "create") recordMutation(query.model, "create", undefined, row(result));
            else if (property === "update" || property === "incrementOne") {
              if (row(result)) recordMutation(query.model, "update", before[0], row(result));
            } else if (property === "consumeOne") recordMutation(query.model, "delete", row(result));
            else if (property === "delete" || property === "deleteMany") {
              if (property === "deleteMany" && result !== before.length) context.observationIncomplete = true;
              // An unrecognized selector has no reliable affected-row result: never claim its
              // pre-read candidates were actually deleted. Native unique selectors use consumeOne.
              if (property === "delete") context.observationIncomplete = true;
              if (property === "deleteMany" && result === before.length) {
                for (const item of before) recordMutation(query.model, "delete", item);
              }
            } else {
              try {
                const after = await adapter.findMany<Row>({
                  model: query.model,
                  where: [{ field: "id", operator: "in", value: before.map((item) => String(item.id)) }],
                  limit: Math.max(before.length, 1),
                });
                for (const item of after) {
                  recordMutation(
                    query.model,
                    "update",
                    before.find((old) => old.id === item.id),
                    item
                  );
                }
                if (result !== before.length) context.observationIncomplete = true;
              } catch {
                context.observationIncomplete = true;
              }
            }
          } catch {
            context.observationIncomplete = true;
          }
          return result;
        },
      });
    },
  });

export const withNativeAuthAuditAdapter =
  (factory: DBAdapterInstance, transactional = false): DBAdapterInstance =>
  (options) => {
    const adapter = factory(options);
    const wrapped = wrapAdapter(adapter);
    return new Proxy(wrapped, {
      get(target, property, receiver) {
        if (property !== "transaction") return Reflect.get(target, property, receiver);
        const transaction: DBAdapter["transaction"] = async (callback) => {
          const parent = nativeAuthAuditContext.getStore();
          if (!parent || !transactional) return adapter.transaction((tx) => callback(wrapAdapter(tx)));
          const child = { ...parent, mutations: [] as AuthMutation[] };
          try {
            const result = await nativeAuthAuditContext.run(child, () =>
              adapter.transaction((tx) => callback(wrapAdapter(tx)))
            );
            parent.mutations.push(...child.mutations);
            parent.observationIncomplete ||= child.observationIncomplete;
            parent.mutationFailed ||= child.mutationFailed;
            return result;
          } catch (error) {
            parent.mutationFailed = true;
            throw error;
          }
        };
        return transaction;
      },
    });
  };
