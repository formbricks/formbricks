import { vi } from "vitest";

/**
 * The PostHog boundary for run failures, mocked for the callers that finalize a run: the runner and
 * both reconcilers. Keeps their suites free of the organization lookup the real capture does.
 */
export const mockCaptureWorkflowRunFailed = vi.fn();

vi.mock("@/modules/ee/workflows/lib/analytics/run-failure", () => ({
  captureWorkflowRunFailed: mockCaptureWorkflowRunFailed,
}));
