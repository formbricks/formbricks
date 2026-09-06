import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { SelectSurveyDecision, SelectSurveyPayload, Survey } from "@/types";
import { getLanguageCode, selectSurvey } from "./select-survey";

const NOW_MS = 1_750_000_000_000;

const buildSurvey = (overrides: Partial<Survey> = {}): Survey => ({
  id: "survey_1",
  displayOption: "respondMultiple",
  triggers: [{ actionClass: { name: "Button Clicked" } }],
  ...overrides,
});

const buildPayload = (overrides: Partial<SelectSurveyPayload> = {}): SelectSurveyPayload => ({
  action: "button_clicked",
  workspaceState: {
    data: {
      data: {
        surveys: [buildSurvey()],
        actionClasses: [{ key: "button_clicked", name: "Button Clicked", type: "code" }],
        settings: {},
      },
    },
  },
  userState: {},
  language: "default",
  nowMs: NOW_MS,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("selectSurvey", () => {
  test("selects the survey matching the tracked action", () => {
    const decision = selectSurvey(buildPayload());

    expect(decision.shouldDisplay).toBe(true);
    expect(decision.surveyId).toBe("survey_1");
    expect(decision.delaySeconds).toBe(0);
    expect(decision.languageCode).toBe("default");
    expect(decision.v).toBe(1);
  });

  test("declines unknown actions", () => {
    const decision = selectSurvey(buildPayload({ action: "unknown_action" }));

    expect(decision.shouldDisplay).toBe(false);
    expect(decision.reason).toContain("unknown");
  });

  test("ignores non-code action classes", () => {
    const payload = buildPayload();
    payload.workspaceState!.data!.data!.actionClasses = [
      { key: "button_clicked", name: "Button Clicked", type: "noCode" },
    ];

    expect(selectSurvey(payload).shouldDisplay).toBe(false);
  });

  test("passes the survey delay through", () => {
    const payload = buildPayload();
    payload.workspaceState!.data!.data!.surveys = [buildSurvey({ delay: 5 })];

    expect(selectSurvey(payload).delaySeconds).toBe(5);
  });

  describe("display type filtering", () => {
    test("displayOnce declines when the survey was already displayed", () => {
      const payload = buildPayload({
        userState: { displays: [{ surveyId: "survey_1", createdAt: "2026-01-01T00:00:00Z" }] },
      });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ displayOption: "displayOnce" })];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("displayMultiple declines after a response", () => {
      const payload = buildPayload({ userState: { responses: ["survey_1"] } });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ displayOption: "displayMultiple" })];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("displaySome respects the display limit", () => {
      const payload = buildPayload({
        userState: {
          displays: [
            { surveyId: "survey_1", createdAt: "2026-01-01T00:00:00Z" },
            { surveyId: "survey_1", createdAt: "2026-01-02T00:00:00Z" },
          ],
        },
      });
      payload.workspaceState!.data!.data!.surveys = [
        buildSurvey({ displayOption: "displaySome", displayLimit: 2 }),
      ];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("unknown display option declines", () => {
      const payload = buildPayload();
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ displayOption: "somethingNew" })];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });
  });

  describe("recontact days", () => {
    test("declines when within the survey recontact window", () => {
      const payload = buildPayload({
        userState: { lastDisplayedAtMs: NOW_MS - 86_400_000 }, // 1 day ago
      });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ recontactDays: 7 })];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("falls back to the workspace default recontact days", () => {
      const payload = buildPayload({
        userState: { lastDisplayedAtMs: NOW_MS - 86_400_000 },
      });
      payload.workspaceState!.data!.data!.settings = { recontactDays: 7 };

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("allows display once the window has passed", () => {
      const payload = buildPayload({
        userState: { lastDisplayedAtMs: NOW_MS - 8 * 86_400_000 }, // 8 days ago
      });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ recontactDays: 7 })];

      expect(selectSurvey(payload).shouldDisplay).toBe(true);
    });
  });

  describe("segments", () => {
    test("anonymous users are excluded from surveys whose segment has filters", () => {
      const payload = buildPayload();
      payload.workspaceState!.data!.data!.surveys = [
        buildSurvey({ segment: { id: "seg_1", hasFilters: true } }),
      ];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("identified users without segments see nothing", () => {
      const payload = buildPayload({ userState: { userId: "user_1", segments: [] } });

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("identified users see surveys for their segments", () => {
      const payload = buildPayload({ userState: { userId: "user_1", segments: ["seg_1"] } });
      payload.workspaceState!.data!.data!.surveys = [
        buildSurvey({ segment: { id: "seg_1", hasFilters: true } }),
      ];

      expect(selectSurvey(payload).shouldDisplay).toBe(true);
    });
  });

  describe("display percentage", () => {
    test("declines when the draw exceeds the percentage", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const payload = buildPayload();
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ displayPercentage: 50 })];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });

    test("displays when the draw is under the percentage", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      const payload = buildPayload();
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ displayPercentage: 50 })];

      expect(selectSurvey(payload).shouldDisplay).toBe(true);
    });
  });

  describe("multi-language surveys", () => {
    const languages = [
      { language: { code: "en", alias: null }, default: true, enabled: true },
      { language: { code: "de", alias: "german" }, default: false, enabled: true },
      { language: { code: "fr", alias: null }, default: false, enabled: false },
    ];

    test("resolves an enabled language by code", () => {
      const payload = buildPayload({ language: "de" });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ languages })];

      const decision = selectSurvey(payload);
      expect(decision.shouldDisplay).toBe(true);
      expect(decision.languageCode).toBe("de");
    });

    test("resolves an enabled language by alias", () => {
      const payload = buildPayload({ language: "german" });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ languages })];

      expect(selectSurvey(payload).languageCode).toBe("de");
    });

    test("maps the default language to 'default'", () => {
      const payload = buildPayload({ language: "en" });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ languages })];

      expect(selectSurvey(payload).languageCode).toBe("default");
    });

    test("declines when the language is disabled", () => {
      const payload = buildPayload({ language: "fr" });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ languages })];

      const decision = selectSurvey(payload);
      expect(decision.shouldDisplay).toBe(false);
      expect(decision.reason).toContain("not available in language");
    });

    test("declines when the language is unknown to the survey", () => {
      const payload = buildPayload({ language: "es" });
      payload.workspaceState!.data!.data!.surveys = [buildSurvey({ languages })];

      expect(selectSurvey(payload).shouldDisplay).toBe(false);
    });
  });
});

describe("getLanguageCode", () => {
  test("returns 'default' for empty or 'default' input", () => {
    const survey = buildSurvey();
    expect(getLanguageCode(survey, null)).toBe("default");
    expect(getLanguageCode(survey, "")).toBe("default");
    expect(getLanguageCode(survey, "default")).toBe("default");
  });
});

// Proves the built bundle runs in a bare JS engine: no DOM, no `window`, no
// `self` — only `globalThis`, matching the JavaScriptCore environment the iOS
// shell provides. Skipped when the bundle hasn't been built yet.
const bundlePath = resolve(__dirname, "../../dist/core.umd.cjs");
describe.skipIf(!existsSync(bundlePath))("built bundle in a DOM-free engine", () => {
  test("evaluates and decides via globalThis.formbricksMobileCore", () => {
    const source = readFileSync(bundlePath, "utf8");
    const sandbox = vm.createContext(Object.create(null) as Record<string, unknown>);

    vm.runInContext(source, sandbox);
    const resultJson = vm.runInContext(
      `JSON.stringify(globalThis.formbricksMobileCore.selectSurvey(${JSON.stringify(buildPayload())}))`,
      sandbox
    ) as string;

    const decision = JSON.parse(resultJson) as SelectSurveyDecision;
    expect(vm.runInContext("globalThis.formbricksMobileCore.protocolVersion", sandbox)).toBe(1);
    expect(decision.shouldDisplay).toBe(true);
    expect(decision.surveyId).toBe("survey_1");
  });
});
