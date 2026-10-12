import { vi } from "vitest";
import type { loadQuotaEvaluationContext as loadQuotaEvaluationContextImpl } from "@/modules/ee/quotas/lib/evaluation-service";

/**
 * Quota-definition loader for the example-response persistence tests, which must stay off the
 * database. Kept in `__mocks__` (per AGENTS.md) so the `vi.mock` call is hoisted by import order.
 */
export const loadQuotaEvaluationContext = vi.fn<typeof loadQuotaEvaluationContextImpl>();

vi.mock("@/modules/ee/quotas/lib/evaluation-service", () => ({
  loadQuotaEvaluationContext,
}));
