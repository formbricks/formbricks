import "server-only";
import { isAPIError } from "better-auth/api";
import { decodeJwt } from "jose";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { loggableError } from "@/lib/utils/loggable-error";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { getUnconsentedMcpGrantPermissions } from "@/modules/mcp/grant";
import { createMcpGrantIfMissing, queueMcpGrantAudit } from "@/modules/mcp/grant-store";
import { trimScopesForDashboardViewer } from "./dashboard-viewer-oauth-scopes";

/**
 * A grant for a `skipConsent` client (ADR-0041). Every MCP request needs its connection's grant, which
 * Allow on the consent screen saves; a client registered with `skipConsent` (a trusted first-party
 * client) is authorized without that screen, so it never got one and every MCP request it made was
 * refused.
 *
 * `hooks.after` for `POST /oauth2/token`: once the provider has issued tokens to such a client, by an
 * authorization code or a refresh, the connection gets a grant if it has none, by the rule the grant
 * migration applied to connections made before grants: All access, every permission at its scope
 * family's level, Tags and Audience at No access (`getUnconsentedMcpGrantPermissions`). The spec says
 * nothing else for first-party clients. A Dashboard viewer's scopes are trimmed first, as the consent
 * screen does. A grant that exists, or that the user narrowed with Edit, is left alone.
 *
 * At issuance rather than on the first MCP request: Revoke deletes the grant and revokes the refresh
 * tokens, so a token minted before it must not bring the grant back; only a new authorization does.
 *
 * Never throws: the tokens are issued (see the handler's `catch`). Without a grant the client's calls are
 * refused, and its next token tries again.
 */

const TOKEN_PATH = "/oauth2/token";
const USER_GRANT_TYPES = new Set(["authorization_code", "refresh_token"]);

/** The user, client and scopes of the access token the provider just issued, read from its response. */
const readIssuedToken = (
  returned: unknown
): { userId: string; clientId: string; scopes: string[] } | null => {
  if (typeof returned !== "object" || returned === null) return null;
  const { access_token: accessToken, scope } = returned as { access_token?: unknown; scope?: unknown };
  if (typeof accessToken !== "string" || typeof scope !== "string") return null;
  let payload: ReturnType<typeof decodeJwt>;
  try {
    // Our own response, just signed: read, not verified. An opaque token has nothing to read.
    payload = decodeJwt(accessToken);
  } catch {
    return null;
  }
  const clientId = typeof payload.azp === "string" ? payload.azp : payload.client_id;
  if (typeof payload.sub !== "string" || typeof clientId !== "string") return null;
  return { userId: payload.sub, clientId, scopes: scope.split(" ").filter(Boolean) };
};

export const grantSkipConsentClientAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== TOKEN_PATH) return;
  const grantType = (ctx.body as { grant_type?: unknown } | undefined)?.grant_type;
  if (typeof grantType !== "string" || !USER_GRANT_TYPES.has(grantType)) return;
  const returned = (ctx.context as { returned?: unknown }).returned;
  if (isAPIError(returned)) return;

  const issued = readIssuedToken(returned);
  if (!issued) return;
  const { userId, clientId, scopes } = issued;
  try {
    const client = await prisma.oauthClient.findUnique({
      where: { clientId },
      select: { skipConsent: true },
    });
    if (client?.skipConsent !== true) return;

    const granted = (await isOnlyDashboardViewer(prisma, userId))
      ? trimScopesForDashboardViewer(scopes)
      : scopes;
    const created = await createMcpGrantIfMissing({
      userId,
      clientId,
      permissions: getUnconsentedMcpGrantPermissions(granted),
    });
    if (!created) return;
    await queueMcpGrantAudit({ action: "created", actorUserId: userId, before: null, after: created });
  } catch (error) {
    // Never rethrown, on purpose: the provider has already issued the tokens, and for a refresh it has
    // rotated the presented refresh token too. Failing here would replace the response with an error the
    // client can't recover from: it would hold neither the new tokens nor a valid old one, and would have
    // to authorize again. Swallowed, the client keeps its tokens, its MCP calls answer 401 while it has no
    // grant, and its next token issuance tries again. A known Prisma error is the expected case (the user
    // or the client deleted while the token was issued, a lost race on the unique key) and is a warning;
    // anything else is a fault and is logged as an error.
    const expected = error instanceof Prisma.PrismaClientKnownRequestError;
    logger[expected ? "warn" : "error"](
      { err: loggableError(error), userId, clientId },
      "Saving the grant of a skipConsent MCP client failed"
    );
  }
};
