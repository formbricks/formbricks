import "server-only";
import { APIError } from "better-auth/api";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { type TMcpGrantPermissions, parseRequestedMcpGrant } from "@/modules/mcp/grant";

/**
 * The grant the consent screen's Allow sends with the approval (ENG-7150): `POST /oauth2/consent` with
 * `mcp_grant: { permissions }` beside `accept`. The provider's own body schema ignores the field; these
 * hooks own it. The before-hook refuses a malformed one before the provider writes the consent, and the
 * consent after-hook (`oauth-grant-revocation.ts`) saves it, capped by the scopes the consent holds.
 *
 * A request without the field (a client that drives the consent endpoint itself) keeps what it got
 * before the matrix existed: every permission at the level its scopes give.
 */

const CONSENT_PATH = "/oauth2/consent";
const FIELD = "mcp_grant";

const approvalBody = (ctx: AuthHookContext): Record<string, unknown> | null => {
  if (ctx.path !== CONSENT_PATH) return null;
  const body = ctx.body as Record<string, unknown> | undefined;
  return body?.accept === true ? body : null;
};

/**
 * The permissions an approval chose, or `null` when it chose none (the field is absent, or it is not an
 * approval). Only call after {@link requireValidMcpGrantOnConsentBeforeHandler} has run on the request.
 */
export const getApprovedMcpGrantPermissions = (ctx: AuthHookContext): TMcpGrantPermissions | null => {
  const body = approvalBody(ctx);
  if (!body || !Object.hasOwn(body, FIELD)) return null;
  return parseRequestedMcpGrant(body[FIELD]);
};

/**
 * `hooks.before` for `POST /oauth2/consent`: an approval carrying a grant must carry a valid one, one
 * the consent screen could have sent (known permissions, offered levels, at least one permission). A
 * Deny is left alone: it writes nothing, so its grant is never read.
 */
export const requireValidMcpGrantOnConsentBeforeHandler = (ctx: AuthHookContext): void => {
  const body = approvalBody(ctx);
  if (!body || !Object.hasOwn(body, FIELD)) return;
  if (parseRequestedMcpGrant(body[FIELD])) return;
  throw new APIError("BAD_REQUEST", {
    error: "invalid_request",
    error_description: "mcp_grant must give at least one permission a level it offers",
  });
};
