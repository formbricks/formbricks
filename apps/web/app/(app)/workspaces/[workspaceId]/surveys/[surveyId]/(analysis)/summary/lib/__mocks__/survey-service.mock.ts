import { vi } from "vitest";

/**
 * Survey-read boundary for the survey-reset tests. Kept in `__mocks__` (per AGENTS.md) so the
 * `vi.mock` call is hoisted by import order rather than by a bare `vi.mock` in each spec.
 */
export const getSurvey = vi.fn();

vi.mock("@/lib/survey/service", () => ({
  getSurvey,
}));
