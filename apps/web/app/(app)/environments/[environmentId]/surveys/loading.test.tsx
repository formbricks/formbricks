import { SurveyListLoading as OriginalSurveyListLoading } from "@/modules/survey/list/loading";
import { describe, expect, test, vi } from "vitest";
import SurveyListLoading from "./loading";

// Mock the original component to ensure we are testing the re-export
vi.mock("@/modules/survey/list/loading", () => ({
  SurveyListLoading: () => <div data-testid="mock-survey-list-loading">Mock SurveyListLoading</div>,
}));

describe("SurveyListLoadingPage Re-export", () => {
  test("should re-export SurveyListLoading from the correct module", () => {
    // Check if the re-exported component is the same as the original (mocked) component
    expect(SurveyListLoading).toBe(OriginalSurveyListLoading);
  });
});
