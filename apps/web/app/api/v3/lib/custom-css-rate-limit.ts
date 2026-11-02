import "server-only";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { applyV3OperationRateLimit } from "./operation-rate-limit";
import type { TV3Authentication } from "./types";

/**
 * The principal CSS processing is charged to: the user (session or OAuth), or the API key. Survey and
 * workspace writes pass it to the custom CSS service, which charges the same budget when the write
 * actually processes.
 */
export { getV3RateLimitPrincipal as getV3CustomCssPrincipal } from "./operation-rate-limit";

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
 * limit. CSS validation is charged here, once per request. Writes — the workspace CSS save, v3 survey
 * create and patch, the editor's save and autosave, copy — are charged by the custom CSS service
 * (`resolveCustomCssWrite`), and only when the write adds or edits CSS, since nothing else processes.
 * REST, MCP and the editor share the budget because they share the identifier.
 *
 * Returns the standard 429 problem when the budget is spent, or `null` to proceed.
 */
export const applyV3CustomCssRateLimit = ({
  authentication,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
}): Promise<Response | null> =>
  applyV3OperationRateLimit({
    config: rateLimitConfigs.api.v3CustomCss,
    authentication,
    requestId,
    instance,
  });
