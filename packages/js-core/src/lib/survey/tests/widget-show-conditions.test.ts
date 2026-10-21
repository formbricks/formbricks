import { type Mock, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import type * as CommonUtils from "@/lib/common/utils";
import { shouldDisplayBasedOnPercentage } from "@/lib/common/utils";
import { passesShowConditions } from "@/lib/survey/show-conditions";
import { mockSurvey } from "@/lib/survey/tests/__mocks__/widget.mock";
import * as widget from "@/lib/survey/widget";
import { getVisitSnapshot } from "@/lib/visit/visit-store";

/**
 * Where the show conditions sit in the display flow (ENG-3875): checked when a trigger fires, before
 * the display percentage and before the survey takes the "a survey is running" lock, and again right
 * before it shows.
 */

vi.mock("@/lib/common/config", () => ({
  Config: { getInstance: vi.fn() },
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: { getInstance: vi.fn(() => ({ debug: vi.fn(), error: vi.fn() })) },
}));

const timeoutStack = { add: vi.fn(), markFired: vi.fn(), remove: vi.fn() };
vi.mock("@/lib/common/timeout-stack", () => ({
  TimeoutStack: { getInstance: vi.fn(() => timeoutStack) },
}));

vi.mock("@/lib/common/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof CommonUtils>();
  return {
    ...actual,
    getBrowserLanguageCodes: vi.fn(() => []),
    getStyling: vi.fn(),
    shouldDisplayBasedOnPercentage: vi.fn(() => true),
  };
});

vi.mock("@/lib/user/update-queue", () => ({
  UpdateQueue: {
    getInstance: vi.fn(() => ({ hasPendingWork: vi.fn(() => false), waitForPendingWork: vi.fn() })),
  },
}));

vi.mock("@/lib/survey/show-conditions", () => ({
  passesShowConditions: vi.fn(() => true),
}));

vi.mock("@/lib/visit/visit-store", () => ({
  getVisitSnapshot: vi.fn(() => null),
}));

const visit = {
  pagesViewed: 4,
  uniquePagesViewed: 3,
  timeOnSite: 130,
  entryReferrer: "https://www.google.com/",
  visitedUrls: ["/", "/plans"],
  uniquePaths: ["/", "/plans"],
};

describe("show conditions in the display flow", () => {
  const renderSurvey = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    widget.setIsSurveyRunning(false);
    window.formbricksSurveys = {
      renderSurvey,
      setNonce: vi.fn(),
      resolveSurveyLanguage: vi.fn(() => "default"),
    };
    vi.mocked(Config.getInstance).mockReturnValue({
      get: vi.fn(() => ({
        appUrl: "https://fake.app",
        workspaceId: "ws_1",
        workspace: { data: { settings: { inAppSurveyBranding: true } } },
        user: { data: { contactId: null, language: "default" } },
      })),
      update: vi.fn(),
    } as unknown as Config);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.formbricksSurveys;
  });

  test("a survey that fails its conditions does not render or block the next survey", async () => {
    (passesShowConditions as Mock).mockReturnValueOnce(false).mockReturnValue(true);

    await widget.triggerSurvey({ ...mockSurvey, id: "fails", delay: 0 }, "New Session");
    await widget.triggerSurvey({ ...mockSurvey, id: "passes", delay: 0 }, "New Session");
    vi.runAllTimers();

    expect(renderSurvey).toHaveBeenCalledTimes(1);
    expect((renderSurvey.mock.calls[0][0] as { survey: { id: string } }).survey.id).toBe("passes");
  });

  test("a survey that fails its conditions does not draw the display percentage", async () => {
    (passesShowConditions as Mock).mockReturnValueOnce(false);

    await widget.triggerSurvey({ ...mockSurvey, displayPercentage: 50 }, "New Session");

    expect(shouldDisplayBasedOnPercentage).not.toHaveBeenCalled();
  });

  test("a delayed survey is checked again when the delay ends, and stays hidden if it now fails", async () => {
    (passesShowConditions as Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);

    await widget.triggerSurvey({ ...mockSurvey, delay: 5 }, "New Session");
    vi.advanceTimersByTime(4999);
    expect(passesShowConditions).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(passesShowConditions).toHaveBeenCalledTimes(2);
    expect(passesShowConditions).toHaveBeenLastCalledWith(expect.anything(), "New Session", "beforeShow");
    expect(renderSurvey).not.toHaveBeenCalled();

    // The lock is released, so a later trigger can still show a survey.
    (passesShowConditions as Mock).mockReturnValue(true);
    await widget.triggerSurvey({ ...mockSurvey, id: "later", delay: 0 }, "New Session");
    vi.runAllTimers();
    expect(renderSurvey).toHaveBeenCalledTimes(1);
  });

  test("a survey without a delay is still checked again before it shows", async () => {
    (passesShowConditions as Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);

    await widget.triggerSurvey({ ...mockSurvey, delay: 0 }, "New Session");
    vi.runAllTimers();

    expect(passesShowConditions).toHaveBeenLastCalledWith(expect.anything(), "New Session", "beforeShow");
    expect(renderSurvey).not.toHaveBeenCalled();
  });

  test("hands the visit at display time to the renderer", async () => {
    vi.mocked(getVisitSnapshot).mockReturnValue(visit);

    await widget.triggerSurvey({ ...mockSurvey, delay: 0 }, "New Session");
    vi.runAllTimers();

    expect(renderSurvey).toHaveBeenCalledWith(expect.objectContaining({ visit }));
  });
});
