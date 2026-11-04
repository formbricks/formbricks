import "server-only";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  applyRateLimit,
  reserveRateLimitUsage,
  settleRateLimitUsage,
} from "@/modules/core/rate-limit/helpers";
import { acquireInFlightSlot, releaseInFlightSlot } from "@/modules/core/rate-limit/in-flight";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { problemTooManyRequests } from "./response";
import type { TV3Authentication } from "./types";

/**
 * The principal an operation's own budget is charged to: the user (session or OAuth), or the API key.
 * REST and MCP share a budget because they share this identifier.
 */
export const getV3RateLimitPrincipal = (authentication: TV3Authentication): string | null => {
  if (authentication && "user" in authentication && authentication.user?.id) return authentication.user.id;
  if (authentication && "apiKeyId" in authentication) return authentication.apiKeyId;
  return null;
};

/**
 * Charge an operation's own budget from inside the operation, where both its REST route and its MCP tool
 * pass — the route wrapper's limit never sees an MCP call. Returns the standard 429 problem when the
 * budget is spent, or `null` to proceed.
 */
export const applyV3OperationRateLimit = async ({
  config,
  authentication,
  requestId,
  instance,
}: {
  config: TRateLimitConfig;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
}): Promise<Response | null> => {
  const principal = getV3RateLimitPrincipal(authentication);
  if (!principal) return null;

  try {
    await applyRateLimit(config, principal);
    return null;
  } catch (error) {
    logger
      .withContext({ requestId })
      .warn({ statusCode: 429, namespace: config.namespace }, "V3 operation rate limit exceeded");
    return problemTooManyRequests(
      requestId,
      error instanceof Error ? error.message : "Rate limit exceeded",
      error instanceof TooManyRequestsError ? error.retryAfter : undefined,
      instance
    );
  }
};

/**
 * Reserve `requested` units of an operation's own budget at once — an operation that fans out into several
 * queries charges each one — and give back what it did not use with `settle`. Returns the standard 429
 * problem when the budget cannot cover them. Nothing is reserved for a caller without a principal, or for
 * zero units; `settle` is then a no-op.
 */
export const reserveV3OperationRateLimit = async ({
  config,
  authentication,
  requestId,
  instance,
  requested,
}: {
  config: TRateLimitConfig;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  requested: number;
}): Promise<{ refused: Response } | { settle: (used: number) => Promise<void> }> => {
  const principal = getV3RateLimitPrincipal(authentication);
  if (!principal || requested <= 0) return { settle: () => Promise.resolve() };

  try {
    const reservation = await reserveRateLimitUsage(config, principal, requested);
    return {
      settle: (used) => settleRateLimitUsage(reservation, Math.min(Math.max(used, 0), requested)),
    };
  } catch (error) {
    logger
      .withContext({ requestId })
      .warn({ statusCode: 429, namespace: config.namespace, requested }, "V3 operation rate limit exceeded");
    return {
      refused: problemTooManyRequests(
        requestId,
        error instanceof Error ? error.message : "Rate limit exceeded",
        error instanceof TooManyRequestsError ? error.retryAfter : undefined,
        instance
      ),
    };
  }
};

/** How soon a caller refused an in-flight slot should retry: a slot frees as soon as a query ends. */
export const IN_FLIGHT_RETRY_AFTER_SECONDS = 1;

type TV3SlotContext = {
  config: TRateLimitConfig;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/**
 * Run `operation` holding one of the principal's in-flight slots in `config` (see `in-flight.ts`): a limit
 * on how many such operations run at once rather than how many start per minute. The slot is taken before
 * the operation and given back when it settles, success or failure; its result comes back as `value`.
 * When every slot is taken nothing runs, and `refused` is the 429 problem with a one-second `Retry-After`.
 * Like every limit here it fails open. For an operation that runs several queries, take one slot per
 * query: a slot's lease is sized to one query, and a slot held across many would free itself mid-way.
 */
export const holdV3OperationSlot = async <T>(
  { config, authentication, requestId, instance }: TV3SlotContext,
  operation: () => Promise<T>
): Promise<{ value: T } | { refused: Response }> => {
  const principal = getV3RateLimitPrincipal(authentication);
  if (!principal) return { value: await operation() };

  const { allowed, slot } = await acquireInFlightSlot(config, principal);
  if (!allowed) {
    logger
      .withContext({ requestId })
      .warn({ statusCode: 429, namespace: config.namespace }, "V3 operation concurrency limit reached");
    return {
      refused: problemTooManyRequests(
        requestId,
        `At most ${config.allowedPerInterval} of these can run at once. Retry when one finishes.`,
        IN_FLIGHT_RETRY_AFTER_SECONDS,
        instance
      ),
    };
  }

  try {
    return { value: await operation() };
  } finally {
    if (slot) await releaseInFlightSlot(slot);
  }
};

/** `holdV3OperationSlot` for an operation that answers with a response: a refusal is the answer. */
export const withV3OperationSlot = async (
  context: TV3SlotContext,
  operation: () => Promise<Response>
): Promise<Response> => {
  const held = await holdV3OperationSlot(context, operation);
  return "refused" in held ? held.refused : held.value;
};
