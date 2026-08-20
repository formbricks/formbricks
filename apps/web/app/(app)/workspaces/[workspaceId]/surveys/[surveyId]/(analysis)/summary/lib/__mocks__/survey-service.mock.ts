import { vi } from "vitest";
import type { getSurvey as getSurveyImpl } from "@/lib/survey/service";

/**
 * Survey-read boundary for the survey-reset tests. Kept in `__mocks__` (per AGENTS.md) so the
 * `vi.mock` call is hoisted by import order rather than by a bare `vi.mock` in each spec. Typed off
 * the real export, so `mockResolvedValue` is checked against `Promise<TSurvey | null>`.
 */
export const getSurvey = vi.fn<typeof getSurveyImpl>();

vi.mock("@/lib/survey/service", () => ({
  getSurvey,
}));
