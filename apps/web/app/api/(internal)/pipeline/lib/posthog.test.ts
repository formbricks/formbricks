import { afterEach, describe, expect, test, vi } from "vitest";
import { captureSurveyResponsePostHogEvent } from "./posthog";

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

describe("captureSurveyResponsePostHogEvent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const makeParams = (responseCount: number) => ({
    organizationId: "org-1",
    surveyId: "survey-1",
    surveyType: "link",
    environmentId: "env-1",
    responseCount,
  });

  test("fires on 1st response with milestone 'first'", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    captureSurveyResponsePostHogEvent(makeParams(1));

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

  test("fires on every 100th response", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    for (const count of [100, 200, 300, 500, 1000, 5000]) {
      captureSurveyResponsePostHogEvent(makeParams(count));
    }

    expect(capturePostHogEvent).toHaveBeenCalledTimes(6);
  });

  test("does NOT fire for 2nd through 99th responses", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    for (const count of [2, 5, 10, 50, 99]) {
      captureSurveyResponsePostHogEvent(makeParams(count));
    }

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("does NOT fire for non-100th counts above 100", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    for (const count of [101, 150, 250, 499, 501]) {
      captureSurveyResponsePostHogEvent(makeParams(count));
    }

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("sets milestone to count string for non-first milestones", async () => {
    const { capturePostHogEvent } = await import("@/lib/posthog");

    captureSurveyResponsePostHogEvent(makeParams(200));

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "org-1",
      "survey_response_received",
      expect.objectContaining({
        is_first_response: false,
        milestone: "200",
      })
    );
  });
});
