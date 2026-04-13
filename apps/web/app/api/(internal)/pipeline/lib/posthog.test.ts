import { afterEach, describe, expect, test, vi } from "vitest";
import { captureSurveyResponsePostHogEvent, shouldCapturePostHogResponseEvent } from "./posthog";

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

describe("shouldCapturePostHogResponseEvent", () => {
  test("fires on 1st response", () => {
    expect(shouldCapturePostHogResponseEvent(1)).toBe(true);
  });

  test("fires on 10th response", () => {
    expect(shouldCapturePostHogResponseEvent(10)).toBe(true);
  });

  test("fires on 50th response", () => {
    expect(shouldCapturePostHogResponseEvent(50)).toBe(true);
  });

  test("fires on 100th response", () => {
    expect(shouldCapturePostHogResponseEvent(100)).toBe(true);
  });

  test("fires on every 500th response", () => {
    expect(shouldCapturePostHogResponseEvent(500)).toBe(true);
    expect(shouldCapturePostHogResponseEvent(1000)).toBe(true);
    expect(shouldCapturePostHogResponseEvent(1500)).toBe(true);
    expect(shouldCapturePostHogResponseEvent(5000)).toBe(true);
  });

  test("does NOT fire for 2nd, 3rd, 4th, 5th responses", () => {
    expect(shouldCapturePostHogResponseEvent(2)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(3)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(4)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(5)).toBe(false);
  });

  test("does NOT fire for non-milestone counts", () => {
    expect(shouldCapturePostHogResponseEvent(7)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(25)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(99)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(101)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(250)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(499)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(501)).toBe(false);
    expect(shouldCapturePostHogResponseEvent(750)).toBe(false);
  });
});

describe("captureSurveyResponsePostHogEvent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("calls capturePostHogEvent for milestone counts", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    captureSurveyResponsePostHogEvent({
      organizationId: "org-1",
      surveyId: "survey-1",
      surveyType: "link",
      environmentId: "env-1",
      responseCount: 1,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith("org-1", "survey_response_received", {
      survey_id: "survey-1",
      survey_type: "link",
      organization_id: "org-1",
      environment_id: "env-1",
      response_count: 1,
      is_first_response: true,
      milestone: "first",
    });
  });

  test("does NOT call capturePostHogEvent for non-milestone counts", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    captureSurveyResponsePostHogEvent({
      organizationId: "org-1",
      surveyId: "survey-1",
      surveyType: "link",
      environmentId: "env-1",
      responseCount: 5,
    });

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("sets milestone to count string for non-first milestones", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    captureSurveyResponsePostHogEvent({
      organizationId: "org-1",
      surveyId: "survey-1",
      surveyType: "app",
      environmentId: "env-1",
      responseCount: 500,
    });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "org-1",
      "survey_response_received",
      expect.objectContaining({
        is_first_response: false,
        milestone: "500",
      })
    );
  });
});
