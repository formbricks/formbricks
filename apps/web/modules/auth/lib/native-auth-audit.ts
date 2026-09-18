import "server-only";
import { isAPIError } from "better-auth/api";
import { createHash, randomUUID } from "node:crypto";
import { AUDIT_LOG_ENABLED } from "@/lib/constants";
import type { TAuditLogEvent, TAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";
import { createAuthPathLabeller } from "./better-auth-path-label";
import { type NativeAuthAuditContext, nativeAuthAuditContext } from "./native-auth-audit-context";
import { emitSecurityAudit } from "./security-audit";
import { securityAuditRequestContext } from "./security-audit-request-context";

const operations: Record<string, TAuditTarget> = {
  "/sign-in/email": "user",
  "/update-user": "user",
  "/change-password": "user",
  "/set-password": "user",
  "/change-email": "user",
  "/verify-email": "user",
  "/send-verification-email": "user",
  "/request-password-reset": "user",
  "/reset-password": "user",
  "/delete-user": "user",
  "/delete-user/callback": "user",
  "/sign-out": "session",
  "/revoke-session": "session",
  "/revoke-sessions": "session",
  "/revoke-other-sessions": "session",
  "/link-social": "account",
  "/unlink-account": "account",
  "/get-access-token": "oauthToken",
  "/refresh-token": "oauthToken",
  "/two-factor/enable": "twoFactorAuth",
  "/two-factor/disable": "twoFactorAuth",
  "/two-factor/verify-totp": "twoFactorAuth",
  "/two-factor/verify-backup-code": "twoFactorAuth",
  "/two-factor/verify-otp": "twoFactorAuth",
  "/two-factor/get-totp-uri": "twoFactorAuth",
  "/two-factor/send-otp": "twoFactorAuth",
  "/two-factor/generate-backup-codes": "twoFactorAuth",
  "/oauth2/authorize": "oauthConsent",
  "/oauth2/continue": "oauthConsent",
  "/oauth2/consent": "oauthConsent",
  "/oauth2/register": "oauthClient",
  "/oauth2/create-client": "oauthClient",
  "/oauth2/update-client": "oauthClient",
  "/oauth2/delete-client": "oauthClient",
  "/oauth2/client/rotate-secret": "oauthClient",
  "/oauth2/update-consent": "oauthConsent",
  "/oauth2/delete-consent": "oauthConsent",
  "/oauth2/token": "oauthToken",
  "/oauth2/revoke": "oauthToken",
  "/oauth2/end-session": "session",
  "/oauth2/end-session/confirm": "session",
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

// These endpoints acknowledge an attempt; success must never assert delivery or an existing account.
const requestOperations = new Set([
  "/send-verification-email",
  "/change-email",
  "/request-password-reset",
  "/two-factor/send-otp",
]);
const preservedSuccess = new Set(["/reset-password", "/delete-user", "/delete-user/callback"]);

const responseSummary = async (result: unknown, thrown: boolean) => {
  let httpStatus = thrown ? 500 : 200;
  let body: Record<string, unknown> = {};
  let redirect: string | null = null;
  if (result instanceof Response) {
    httpStatus = result.status;
    redirect = result.headers.get("location");
    if (result.headers.get("content-type")?.includes("application/json")) {
      body = asRecord(
        await result
          .clone()
          .json()
          .catch(() => undefined)
      );
    }
  } else if (isAPIError(result)) {
    httpStatus = result.statusCode;
    redirect = result.headers ? new Headers(result.headers).get("location") : null;
  } else {
    const record = asRecord(result);
    body = asRecord(record.response ?? result);
    if (record.headers instanceof Headers) redirect = record.headers.get("location");
  }
  if (typeof body.url === "string" && body.redirect) redirect = body.url;
  let redirectDenied = false;
  if (redirect) {
    try {
      redirectDenied = new URL(redirect, "http://localhost").searchParams.has("error");
    } catch {
      redirectDenied = true;
    }
  }
  return { httpStatus, body, redirectDenied, redirect };
};

const finishAudit = async (context: NativeAuthAuditContext, result: unknown, thrown: boolean) => {
  try {
    const {
      httpStatus,
      body,
      redirectDenied: redirectedToError,
      redirect,
    } = await responseSummary(result, thrown);
    const callback = context.path.startsWith("/callback/");
    const mintedSession = context.mutations.some(
      (item) => item.model === "session" && item.operation === "create"
    );
    const redirectDenied = redirectedToError && !(callback && mintedSession);
    const failed = httpStatus >= 400 || redirectDenied || context.mutationFailed;
    if (callback) {
      // User creation belongs to ENG-2347. Existing-account linking and profile sync are
      // account changes; ordinary provider token refreshes have no allowlisted changed fields.
      const createdUsers = new Set(
        context.mutations
          .filter((item) => item.model === "user" && item.operation === "create")
          .map(({ id }) => id)
      );
      context.mutations = context.mutations.filter(
        (item) =>
          (item.model === "user" && item.operation === "update" && !createdUsers.has(item.id)) ||
          (item.model === "account" && !createdUsers.has(item.subjectId ?? ""))
      );
    }
    const changed = context.mutations.length > 0;
    if (context.path === "/sign-in/email" && (!failed || context.failureAudited)) return;
    // SSO sign-in itself and reset/deletion completion retain their existing dedicated events.
    if (!failed && !context.observationIncomplete && changed && preservedSuccess.has(context.path)) return;
    if (callback && !failed && !changed) return;

    const issuedTokens: string[] = [];
    if (
      !failed &&
      redirect &&
      ["/oauth2/authorize", "/oauth2/continue", "/oauth2/consent"].includes(context.path)
    ) {
      const code = new URL(redirect, "http://localhost").searchParams.get("code");
      if (code) issuedTokens.push(`sha256:${createHash("sha256").update(code).digest("hex")}`);
    }
    if (!failed && ["/oauth2/token", "/get-access-token", "/refresh-token"].includes(context.path)) {
      for (const key of ["access_token", "refresh_token", "accessToken"]) {
        if (typeof body[key] === "string") {
          issuedTokens.push(`sha256:${createHash("sha256").update(body[key]).digest("hex")}`);
        }
      }
    }
    const requestAccepted = !failed && requestOperations.has(context.path);
    const factorVerified =
      !failed &&
      context.path.startsWith("/two-factor/verify-") &&
      (body.status === true || body.user !== undefined);
    const credentialAccessed =
      !failed && context.path === "/two-factor/get-totp-uri" && typeof body.totpURI === "string";
    let status: TAuditLogEvent["status"];
    if (failed)
      status = changed
        ? "partial"
        : (httpStatus >= 400 && httpStatus < 500) || redirectDenied
          ? "denied"
          : "failure";
    else if (context.observationIncomplete) status = "partial";
    else
      status =
        changed || requestAccepted || factorVerified || credentialAccessed || issuedTokens.length
          ? "success"
          : "noop";

    const targetType = callback ? "user" : operations[context.path];
    const resource = context.mutations.find((item) => context.targetModels.includes(item.model));
    // A successful bearer-token operation establishes the subject via persisted state. A failed
    // request never promotes a submitted email/client_id/token to an authenticated principal.
    if (context.actor.type === "anonymous" && status === "success" && resource) {
      if (["/oauth2/token", "/oauth2/revoke"].includes(context.path) && resource.clientId) {
        context.actor = { id: resource.clientId, type: "oauthClient" };
      } else if (context.path.startsWith("/oauth2/end-session") && resource.subjectId) {
        context.actor = { id: resource.subjectId, type: "user" };
      } else if (context.path === "/verify-email") {
        context.actor = { id: resource.subjectId ?? resource.id, type: "user" };
      }
    }
    if (
      !failed &&
      context.actor.type === "anonymous" &&
      context.oauthClientId &&
      ["/oauth2/token", "/oauth2/revoke"].includes(context.path)
    ) {
      context.actor = { id: context.oauthClientId, type: "oauthClient" };
    }
    await emitSecurityAudit({
      operation: callback ? "sso_callback" : context.path.slice(1),
      action:
        context.path === "/sign-out"
          ? "userSignedOut"
          : context.path === "/sign-in/email"
            ? "authenticationAttempted"
            : "securityOperation",
      actor: callback && changed ? { id: "sso", type: "system" } : context.actor,
      target: { type: targetType, id: resource?.id ?? issuedTokens[0] ?? context.target?.id ?? "unknown" },
      status,
      source: "native-auth",
      requestId: context.requestId,
      changes: {
        resources: context.mutations,
        ...(issuedTokens.length ? { issuedTokenFingerprints: issuedTokens } : {}),
        ...(requestAccepted ? { requestAccepted: true } : {}),
        ...(context.authenticationStage ? { authenticationStage: context.authenticationStage } : {}),
        ...(context.observationIncomplete ? { observationIncomplete: true } : {}),
        ...(failed
          ? {
              reason: context.mutationFailed
                ? "mutation_failed"
                : redirectDenied
                  ? "redirect_denied"
                  : "request_failed",
            }
          : {}),
        ...(credentialAccessed ? { credentialAccessed: true } : {}),
        ...(factorVerified ? { factorVerified: true } : {}),
        httpStatus,
      },
    });
  } catch {
    // Response inspection and the entire audit pipeline are best-effort, including non-JSON errors.
  }
};

/** A boundary outside Better Auth's dispatch sees origin/schema/rate-limit/before-hook denials,
 * thrown faults AND handled failures. The same boundary wraps auth.api calls from server actions.
 * It never reads a request body and never changes the response, cookies or thrown error.
 */
export const withNativeAuthAudit = <
  T extends {
    handler: (request: Request) => Promise<Response>;
    api: Record<string, unknown>;
  },
>(
  auth: T
): T => {
  const label = createAuthPathLabeller(
    Object.values(auth.api).map((endpoint) =>
      typeof endpoint === "function" ? Reflect.get(endpoint, "path") : undefined
    )
  );
  const run = async <R>(path: string, headers: Headers | undefined, invoke: () => Promise<R>): Promise<R> => {
    const callback = path.startsWith("/callback/");
    if (!AUDIT_LOG_ENABLED || (!operations[path] && !callback)) return invoke();
    const context: NativeAuthAuditContext = {
      path,
      requestId: securityAuditRequestContext.getStore() ?? randomUUID(),
      actor: { id: "unknown", type: "anonymous" },
      mutations: [],
      target: { type: operations[path] ?? "user", id: "unknown" },
      targetModels:
        operations[path] === "oauthToken"
          ? ["oauthAccessToken", "oauthRefreshToken"]
          : [operations[path] === "twoFactorAuth" ? "twoFactor" : (operations[path] ?? "user")],
    };
    // Use the library's session verifier, never caller-supplied userId/email. Disable cookie cache
    // and refresh so observing a session neither trusts a revoked cache nor prolongs its lifetime.
    if (headers) {
      try {
        const getSession = auth.api.getSession;
        if (typeof getSession === "function") {
          const session = asRecord(
            await getSession({ headers, query: { disableCookieCache: true, disableRefresh: true } })
          );
          const user = asRecord(session.user);
          if (typeof user.id === "string") {
            context.actor = { id: user.id, type: "user" };
            if (context.target?.type === "user") context.target.id = user.id;
            const currentSession = asRecord(session.session);
            if (
              context.target?.type === "session" &&
              path === "/sign-out" &&
              typeof currentSession.id === "string"
            )
              context.target.id = currentSession.id;
          }
        }
      } catch {
        context.observationIncomplete = true;
      }
    }
    return nativeAuthAuditContext.run(context, async () => {
      let result: R;
      try {
        result = await invoke();
      } catch (error) {
        await finishAudit(context, error, true);
        throw error;
      }
      await finishAudit(context, result, false);
      return result;
    });
  };
  return {
    ...auth,
    handler: (request: Request) => run(label(request.url), request.headers, () => auth.handler(request)),
    api: new Proxy(auth.api, {
      get(target, property, receiver) {
        const endpoint = Reflect.get(target, property, receiver);
        if (typeof endpoint !== "function") return endpoint;
        // Proxy preserves .path/.options and the exact inferred API types.
        return new Proxy(endpoint, {
          apply(fn, thisArg, args: unknown[]) {
            const input = asRecord(args[0]);
            const path = Reflect.get(fn, "path") as string;
            return run(
              path,
              input.headers ? new Headers(input.headers as HeadersInit) : undefined,
              async () => Reflect.apply(fn, thisArg, args)
            );
          },
        });
      },
    }),
  };
};
