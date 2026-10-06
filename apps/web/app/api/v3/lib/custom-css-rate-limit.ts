import "server-only";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { problemTooManyRequests } from "./response";
import type { TV3Authentication } from "./types";

/**
 * The principal CSS processing is charged to: the user (session or OAuth), or the API key. Survey writes
 * pass it to the custom CSS service, which charges the same budget when the write actually processes.
 */
export const getV3CustomCssPrincipal = (authentication: TV3Authentication): string | null => {
  if (authentication && "user" in authentication && authentication.user?.id) return authentication.user.id;
  if (authentication && "apiKeyId" in authentication) return authentication.apiKeyId;
  return null;
};

/**
 * Whether a survey validation request runs the custom CSS processor: the CSS-only variant, or a create or
 * patch dry run whose payload carries a `customCss` key.
 */
export const isCustomCssValidationRequest = (body: { operation: string; data?: unknown }): boolean =>
  body.operation === "customCss" ||
  (typeof body.data === "object" &&
    body.data !== null &&
    !Array.isArray(body.data) &&
    Object.hasOwn(body.data, "customCss"));

/**
 * The custom CSS processor runs synchronously on the request thread (up to ~0.8 s on pathological input),
 * so every operation that runs it is charged against a tighter per-principal budget on top of the v3
 * limit. CSS validation and workspace CSS saves are charged here, once per request. Survey writes — v3
 * create and patch, the editor's save and autosave, copy — are charged by the custom CSS service
 * (`resolveCustomCssWrite`), and only when the write adds or edits CSS, since nothing else processes.
 * REST, MCP and the editor share the budget because they share the identifier.
 *
 * Returns the standard 429 problem when the budget is spent, or `null` to proceed.
 */
export const applyV3CustomCssRateLimit = async ({
  authentication,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
}): Promise<Response | null> => {
  const principal = getV3CustomCssPrincipal(authentication);
  if (!principal) return null;

  try {
    await applyRateLimit(rateLimitConfigs.api.v3CustomCss, principal);
    return null;
  } catch (error) {
    logger.withContext({ requestId }).warn({ statusCode: 429 }, "Custom CSS processing rate limit exceeded");
    return problemTooManyRequests(
      requestId,
      error instanceof Error ? error.message : "Rate limit exceeded",
      error instanceof TooManyRequestsError ? error.retryAfter : undefined,
      instance
    );
  }
};
