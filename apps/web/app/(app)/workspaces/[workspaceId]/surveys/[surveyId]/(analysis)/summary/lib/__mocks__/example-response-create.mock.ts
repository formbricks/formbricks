import { vi } from "vitest";
import type {
  createResponseWithQuotaEvaluation as createResponseWithQuotaEvaluationImpl,
  resolveCreateResponseContext as resolveCreateResponseContextImpl,
} from "@/app/api/v1/client/[workspaceId]/responses/lib/response";

/**
 * Response-creation boundary for the example-response persistence tests. Kept in `__mocks__` (per
 * AGENTS.md) so the `vi.mock` call is hoisted by import order rather than by a bare `vi.mock` in the
 * spec. Typed off the real export, so the transaction client the spec asserts on is checked against
 * the real second parameter.
 */
export const createResponseWithQuotaEvaluation = vi.fn<typeof createResponseWithQuotaEvaluationImpl>();
export const resolveCreateResponseContext = vi.fn<typeof resolveCreateResponseContextImpl>();

vi.mock("@/app/api/v1/client/[workspaceId]/responses/lib/response", () => ({
  createResponseWithQuotaEvaluation,
  resolveCreateResponseContext,
}));
