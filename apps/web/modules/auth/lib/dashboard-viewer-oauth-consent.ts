import "server-only";
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { isDashboardViewerOnly } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { trimScopesForDashboardViewer } from "./dashboard-viewer-oauth-scopes";

const CONSENT_PATH = "/oauth2/consent";
const CONSENT_UPDATE_PATH = "/oauth2/update-consent";

const splitScopes = (value: unknown): string[] =>
  typeof value === "string" ? value.split(" ").filter(Boolean) : [];

const refuse = (): never => {
  throw new APIError("FORBIDDEN", {
    error: "access_denied",
    error_description: "A Dashboard viewer can only grant dashboards:read",
  });
};

/**
 * `hooks.before` for `POST /oauth2/consent` and `POST /oauth2/update-consent` (ADR-0018, ENG-6889).
 *
 * A user who is only ever a Dashboard viewer approves at most `dashboards:read` (plus identity and
 * refresh), whatever the client asked for and whatever the consent page sent: the approval is rewritten
 * to that subset of the signed authorization request before the provider stores the consent, so the
 * code and every token minted from it are that narrow. A client that asked for no dashboard access gets
 * `access_denied`. Narrowing an existing consent to that subset is allowed; widening it is refused.
 *
 * Runs before the provider's own hook, so it verifies the signed `oauth_query` itself rather than
 * reading the provider's request state, which is not set yet.
 */
export const restrictDashboardViewerConsentBeforeHandler = async (
  ctx: AuthHookContext
): Promise<{ context: { body: Record<string, unknown> } } | undefined> => {
  if (ctx.path !== CONSENT_PATH && ctx.path !== CONSENT_UPDATE_PATH) return undefined;
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  if (ctx.path === CONSENT_PATH && body.accept !== true) return undefined;

  const session = await getSessionFromCtx(ctx);
  if (!session?.user || !(await isDashboardViewerOnly(session.user.id))) return undefined;

  if (ctx.path === CONSENT_UPDATE_PATH) {
    const update = body.update as { scopes?: unknown } | undefined;
    const scopes = Array.isArray(update?.scopes) ? update.scopes.map(String) : [];
    if (trimScopesForDashboardViewer(scopes).length !== scopes.length) refuse();
    return undefined;
  }

  const oauthQuery = typeof body.oauth_query === "string" ? body.oauth_query : null;
  if (!oauthQuery || !(await verifyOAuthQueryParams(oauthQuery, ctx.context.secret))) refuse();
  const requested =
    body.scope === undefined
      ? splitScopes(new URLSearchParams(oauthQuery as string).get("scope"))
      : splitScopes(body.scope);
  const granted = trimScopesForDashboardViewer(requested);
  if (!granted.includes("dashboards:read")) refuse();

  return { context: { body: { ...body, scope: granted.join(" ") } } };
};
