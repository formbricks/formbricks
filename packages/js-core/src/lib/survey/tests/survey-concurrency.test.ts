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
    data: {
      contactId: "contact-1",
      userId: "user-1",
      segments: [],
      displays: [],
      responses: [],
      lastDisplayAt: null,
      language: "en",
    },
  },
  workspace: {
    data: {
      actionClasses,
      surveys: [],
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

  describe("a creative's click (ADR 0004: the click wins)", () => {
    beforeEach(() => {
      // The widget module keeps the surveys on screen across tests; start from none.
      widget.closeSurvey();
    });

    const renderedSurveyIds = (): string[] =>
      renderSurvey.mock.calls.map(([props]) => (props as { survey: TWorkspaceStateSurvey }).survey.id);

    test("opens its survey right away, ignoring the survey's delay and auto-close", async () => {
      await widget.openSurveyForCreative({ ...survey, delay: 60, autoClose: 10 }, "creative-1", []);
      await vi.advanceTimersByTimeAsync(0);

      expect(renderSurvey).toHaveBeenCalledTimes(1);
      const [[props]] = renderSurvey.mock.calls as [[{ survey: TWorkspaceStateSurvey }]];
      expect(props.survey).toEqual(expect.objectContaining({ id: survey.id, autoClose: null }));
      expect(widget.getOpenSurveyIds()).toEqual([survey.id]);
    });

    test("tells the renderer which creative opened it, so the display and response record it", async () => {
      await widget.openSurveyForCreative(survey, "creative-1", []);
      await vi.advanceTimersByTimeAsync(0);

      const [[props]] = renderSurvey.mock.calls as [[{ creativeId?: string }]];
      expect(props.creativeId).toBe("creative-1");
    });

    test("names no creative for a survey its own trigger opened", async () => {
      await widget.renderWidget(survey, PAGE_VIEW_ACTION);
      await vi.advanceTimersByTimeAsync(10);

      const [[props]] = renderSurvey.mock.calls as [[{ creativeId?: string }]];
      expect(props.creativeId).toBeUndefined();
    });

    test("closes the survey on screen, then opens its own", async () => {
      await widget.renderWidget({ ...survey, id: "triggered" }, PAGE_VIEW_ACTION);
      await vi.advanceTimersByTimeAsync(10);

      await widget.openSurveyForCreative(survey, "creative-1", widget.getOpenSurveyIds());
      await vi.advanceTimersByTimeAsync(0);

      expect(renderedSurveyIds()).toEqual(["triggered", survey.id]);
      expect(widget.getOpenSurveyIds()).toEqual([survey.id]);
    });

    test("calls off a survey still waiting out its delay, which then never shows", async () => {
      await widget.renderWidget({ ...survey, id: "delayed", delay: 30 }, PAGE_VIEW_ACTION);
      await vi.advanceTimersByTimeAsync(10);
      // Waiting out its delay is not open: nothing is on screen yet.
      expect(widget.getOpenSurveyIds()).toEqual([]);

      await widget.openSurveyForCreative(survey, "creative-1", widget.getOpenSurveyIds());
      await vi.advanceTimersByTimeAsync(60_000);

      expect(renderedSurveyIds()).toEqual([survey.id]);
    });

    test("opens its own survey right away while that survey's trigger is still waiting out its delay", async () => {
      await widget.renderWidget({ ...survey, delay: 30 }, PAGE_VIEW_ACTION);
      await vi.advanceTimersByTimeAsync(10);
      // Not open, so `resolveClick` opens it instead of treating the press as one on its open survey.
      expect(widget.getOpenSurveyIds()).not.toContain(survey.id);

      await widget.openSurveyForCreative(survey, "creative-1", widget.getOpenSurveyIds());
      await vi.advanceTimersByTimeAsync(0);
      expect(renderedSurveyIds()).toEqual([survey.id]);

      // The delayed render was called off: the survey shows once, not again when the delay ends.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(renderedSurveyIds()).toEqual([survey.id]);
    });

    test("counts its survey as open while it is still on its way to the screen", async () => {
      const opening = widget.openSurveyForCreative(survey, "creative-1", []);

      expect(widget.getOpenSurveyIds()).toEqual([survey.id]);
      await opening;
    });
  });
});
