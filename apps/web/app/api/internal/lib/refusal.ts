import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { problemForbidden } from "@/app/api/v3/lib/response";

/**
 * Run a guarded step whose refusals answer 403: an `OperationNotAllowedError` with its own reason (the
 * caller was authorized, so the reason reveals nothing), and a `ResourceNotFoundError` with the generic
 * 403, the same as a resource the caller can't see. Resolves to the 403 `Response`, or `null` when the
 * step went through; any other error propagates.
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
    if (error instanceof OperationNotAllowedError)
      return problemForbidden(requestId, error.message, instance);
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }
}
