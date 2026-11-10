import "server-only";
import {
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { problemForbidden, problemUnprocessableContent } from "@/app/api/v3/lib/response";

/**
 * The 403 for a refusal: an `OperationNotAllowedError` with its own reason (the caller was authorized, so
 * the reason reveals nothing), and a `ResourceNotFoundError` with the generic 403, the same as a resource
 * the caller can't see. `null` for any other error.
 */
const forbiddenRefusal = (error: unknown, requestId: string, instance?: string): Response | null => {
  if (error instanceof OperationNotAllowedError) return problemForbidden(requestId, error.message, instance);
  if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
  return null;
};

/**
 * Run a guarded step whose refusals answer 403 (see `forbiddenRefusal`). Resolves to the 403 `Response`,
 * or `null` when the step went through; any other error propagates.
 */
export async function forbidOnRefusal(
  step: () => Promise<unknown>,
  requestId: string,
  instance?: string
): Promise<Response | null> {
  try {
    await step();
    return null;
  } catch (error) {
    const refused = forbiddenRefusal(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }
}

/**
 * The answer to a service's refusal, or `null` for an error that isn't one: the 403s of `forbidOnRefusal`,
 * and a 422 with its reason for an `InvalidInputError` or a `ValidationError`, raised by a service for a write
 * it can't take (a survey that fails its own validation, say) — the message the server action this route
 * replaces showed the user as is.
 */
export const refusalResponse = (error: unknown, requestId: string, instance?: string): Response | null => {
  const refused = forbiddenRefusal(error, requestId, instance);
  if (refused) return refused;
  if (error instanceof InvalidInputError || error instanceof ValidationError) {
    return problemUnprocessableContent(requestId, error.message, { instance });
  }
  return null;
};
