import { beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import { checkPageUrl } from "@/lib/survey/no-code-action";
import { mockSurvey } from "@/lib/survey/tests/__mocks__/widget.mock";
import * as widget from "@/lib/survey/widget";
import { type TWorkspaceStateSurvey } from "@/types/config";

/**
 * `isSurveyRunning` is the only thing standing between one survey on screen and two. These tests run
 * the real widget, the real no-code URL check and the real TimeoutStack together, because the bug
 * they pin (ENG-2849) lived in the seam between them rather than in any one of the three: an entry
 * whose timeout had fired still looked like a cancellable schedule, so navigating away released the
 * guard while its survey was up, and the renderer appends containers rather than replacing them.
 */

vi.mock("@/lib/common/command-queue", () => ({
  CommandQueue: { getInstance: vi.fn(() => ({ add: vi.fn() })) },
  CommandType: { GeneralAction: "GeneralAction" },
}));

const PAGE_VIEW_ACTION = "Pricing Page View";
const MATCHING_URL = "https://example.com/pricing";
const OTHER_URL = "https://example.com/home";

const actionClasses = [
  {
    id: "action-1",
    name: PAGE_VIEW_ACTION,
    type: "noCode" as const,
    key: null,
    noCodeConfig: {
      type: "pageView" as const,
      urlFilters: [{ rule: "contains" as const, value: "/pricing" }],
      urlFiltersConnector: "or" as const,
    },
    createdAt: new Date("2025-01-01T10:00:00Z"),
    updatedAt: new Date("2025-01-01T10:00:00Z"),
  },
];

const configState = {
  appUrl: "https://app.example.com",
  workspaceId: "workspace-1",
  user: {
    data: { contactId: "contact-1", userId: "user-1", displays: [], responses: [], language: "en" },
  },
  workspace: {
    data: {
      actionClasses,
      recaptchaSiteKey: undefined,
      settings: {
        styling: { allowStyleOverwrite: false },
        placement: "bottomRight",
        clickOutsideClose: true,
        overlay: "light",
        inAppSurveyBranding: false,
      },
    },
  },
  filteredSurveys: [],
};

// `languages: []` keeps the multi-language branch out of the way; `delay: 0` because the bug does not
// need one — the entry is added for every action-triggered survey, delayed or not.
const survey: TWorkspaceStateSurvey = { ...mockSurvey, delay: 0, languages: [] };

describe("survey concurrency guard", () => {
  let renderSurvey: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    widget.setIsSurveyRunning(false);
    TimeoutStack.getInstance().clear();

    renderSurvey = vi.fn();
    window.formbricksSurveys = { renderSurvey, setNonce: vi.fn() } as unknown as Window["formbricksSurveys"];
    window.location.href = MATCHING_URL;

    vi.spyOn(Config, "getInstance").mockReturnValue({
      get: () => configState,
      update: vi.fn(),
    } as unknown as Config);
  });

  test("navigating away from a rendered survey's url does not let a second survey render", async () => {
    await widget.renderWidget(survey, PAGE_VIEW_ACTION);
    await vi.advanceTimersByTimeAsync(10);

    expect(renderSurvey).toHaveBeenCalledTimes(1);

    // SPA navigation while the survey is still on screen.
    window.location.href = OTHER_URL;
    await checkPageUrl();

    // Any other trigger — a click action, a code action, another page view.
    await widget.renderWidget({ ...survey, id: "second-survey" }, "Some Other Action");
    await vi.advanceTimersByTimeAsync(10);

    expect(renderSurvey).toHaveBeenCalledTimes(1);
  });

  test("navigating away from a survey still waiting out its delay does cancel it", async () => {
    // The behaviour the TimeoutStack exists for, and the one the fix must not cost us.
    await widget.renderWidget({ ...survey, delay: 60 }, PAGE_VIEW_ACTION);
    await vi.advanceTimersByTimeAsync(10);

    expect(renderSurvey).not.toHaveBeenCalled();

    window.location.href = OTHER_URL;
    await checkPageUrl();

    // The cancelled survey never appears...
    await vi.advanceTimersByTimeAsync(60_000);
    expect(renderSurvey).not.toHaveBeenCalled();

    // ...and the guard was released, so a later legitimate trigger still works.
    await widget.renderWidget({ ...survey, id: "later-survey" }, "Some Other Action");
    await vi.advanceTimersByTimeAsync(10);
    expect(renderSurvey).toHaveBeenCalledTimes(1);
  });
});
