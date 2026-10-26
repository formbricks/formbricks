import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TShowConditionGroup, TVisitSnapshot } from "@formbricks/types/show-conditions";
import { emitDebugSurveyEvent, isDebugEnabled } from "@/lib/common/debug";
import { passesShowConditions } from "@/lib/survey/show-conditions";
import { getVisitSnapshot } from "@/lib/visit/visit-store";
import { type TWorkspaceStateSurvey } from "@/types/config";

vi.mock("@/lib/common/debug", () => ({
  isDebugEnabled: vi.fn(() => false),
  emitDebugSurveyEvent: vi.fn(),
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: { getInstance: vi.fn(() => ({ debug: vi.fn(), error: vi.fn() })) },
}));

vi.mock("@/lib/visit/device", () => ({
  getDeviceInfo: vi.fn(() => ({ deviceType: "desktop", browser: "chrome", screenWidth: 1280 })),
}));

vi.mock("@/lib/visit/visit-store", () => ({
  getVisitSnapshot: vi.fn(),
}));

const visit: TVisitSnapshot = {
  pagesViewed: 3,
  uniquePagesViewed: 2,
  timeOnSite: 90,
  entryReferrer: "https://www.google.com/",
  visitedUrls: ["/", "/plans"],
  uniquePaths: ["/", "/plans"],
};

const rule = (...conditions: TShowConditionGroup["conditions"]): TShowConditionGroup => ({
  id: "root",
  connector: "and",
  conditions,
});

const onPlansPage = {
  id: "url",
  leftOperand: { type: "page" as const, value: "currentUrl" as const },
  operator: "contains" as const,
  rightOperand: { type: "static" as const, value: "/plans" },
};

const threePages = {
  id: "pages",
  leftOperand: { type: "visit" as const, value: "pagesViewed" as const },
  operator: "isGreaterThanOrEqual" as const,
  rightOperand: { type: "static" as const, value: 3 },
};

const survey = (showConditions: TShowConditionGroup | null) =>
  ({ id: "survey_1", showConditions }) as unknown as TWorkspaceStateSurvey;

describe("passesShowConditions", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { ...window, location: { href: "https://www.medicare.gov/plans/compare" } });
    vi.stubGlobal("document", { ...document, referrer: "" });
    vi.mocked(getVisitSnapshot).mockReturnValue(visit);
    vi.mocked(isDebugEnabled).mockReturnValue(false);
  });

  test("a survey without conditions passes without reading anything", () => {
    expect(passesShowConditions(survey(null), "New Session", "trigger")).toBe(true);
    expect(getVisitSnapshot).not.toHaveBeenCalled();
    expect(emitDebugSurveyEvent).not.toHaveBeenCalled();
  });

  test("passes when the page and the visit match", () => {
    expect(passesShowConditions(survey(rule(onPlansPage, threePages)), "New Session", "trigger")).toBe(true);
  });

  test("fails when the visit does not match yet", () => {
    vi.mocked(getVisitSnapshot).mockReturnValue({ ...visit, pagesViewed: 2 });

    expect(passesShowConditions(survey(rule(onPlansPage, threePages)), "New Session", "trigger")).toBe(false);
  });

  test("fails a visit condition when the visit store is unavailable", () => {
    vi.mocked(getVisitSnapshot).mockReturnValue(null);

    expect(passesShowConditions(survey(rule(threePages)), "New Session", "trigger")).toBe(false);
  });

  test("in debug mode, reports the outcome with every condition's result", () => {
    vi.mocked(isDebugEnabled).mockReturnValue(true);
    vi.mocked(getVisitSnapshot).mockReturnValue({ ...visit, pagesViewed: 1 });

    const conditions = rule(onPlansPage, threePages);
    passesShowConditions(survey(conditions), "New Session", "beforeShow");

    expect(emitDebugSurveyEvent).toHaveBeenCalledWith({
      surveyId: "survey_1",
      action: "New Session",
      stage: "beforeShow",
      outcome: "conditionsFailed",
      showConditions: conditions,
      conditions: {
        passed: false,
        results: [
          { conditionId: "url", actual: "https://www.medicare.gov/plans/compare", passed: true },
          { conditionId: "pages", actual: 1, passed: false },
        ],
        groups: [{ groupId: "root", connector: "and", passed: false }],
      },
    });
  });

  test("fails closed instead of throwing when the stored conditions are malformed", () => {
    vi.mocked(isDebugEnabled).mockReturnValue(true);
    const groupWithoutConditions = { id: "root", connector: "and" } as unknown as TShowConditionGroup;

    expect(passesShowConditions(survey(groupWithoutConditions), "New Session", "trigger")).toBe(false);
    expect(emitDebugSurveyEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ surveyId: "survey_1", outcome: "conditionsUnreadable" })
    );
  });
});
