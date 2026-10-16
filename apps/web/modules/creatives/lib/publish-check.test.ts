import { describe, expect, test } from "vitest";
import type { TShowConditionSingle, TShowConditions } from "@formbricks/types/show-conditions";
import type { TBannerForm, TCreativeDistributionForm, TCreativeEditorForm } from "./editor-form";
import { PUBLISH_ISSUE_TABS, getInvalidParamTab, getPublishIssues, getSaveIssues } from "./publish-check";

// Styling has no publish rules; the workspace look is a complete one.
const workspaceTheme = {
  customStyles: false,
  backgroundColor: null,
  textColor: null,
  borderColor: null,
  fontWeight: null,
  fontSize: { desktop: null, phone: null },
  paddingX: { desktop: null, phone: null },
  paddingY: { desktop: null, phone: null },
};

const everyPageView: TCreativeDistributionForm = {
  showOn: "pageView",
  actionClassIds: [],
  conditions: null,
  displayPercentage: null,
};

const readyButton: TCreativeEditorForm = {
  name: "Site feedback",
  content: { type: "feedbackButton", label: "Feedback", icon: "messageSquare" },
  destination: { type: "survey", surveyId: "clsurvey0000000000000001" },
  styling: {
    type: "feedbackButton",
    position: { desktop: { edge: "right", offset: 50 }, phone: null },
    theme: { ...workspaceTheme, borderRadius: null },
  },
  distribution: everyPageView,
  schedule: { startAt: null, endAt: null },
  languages: { defaultLanguage: "en-US", others: [], texts: {} },
};

const readyBanner: TCreativeEditorForm = {
  name: "Maintenance",
  content: {
    type: "banner",
    message: [{ text: "Down tonight from 02:00." }],
    hasButton: false,
    buttonLabel: "",
    dismissible: true,
    accessibleName: "",
  },
  destination: { type: "survey", surveyId: null },
  styling: {
    type: "banner",
    position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
    theme: workspaceTheme,
  },
  distribution: everyPageView,
  schedule: { startAt: null, endAt: null },
  languages: { defaultLanguage: "en-US", others: [], texts: {} },
};

const withDistribution = (patch: Partial<TCreativeDistributionForm>): TCreativeEditorForm => ({
  ...readyButton,
  distribution: { ...everyPageView, ...patch },
});

const urlCondition = (value: string): TShowConditionSingle => ({
  id: "clcondition0000000000001",
  leftOperand: { type: "page", value: "currentUrl" },
  operator: "contains",
  rightOperand: { type: "static", value },
});

const showWhen = (...conditions: TShowConditionSingle[]): TShowConditions => ({
  id: "clgroup00000000000000001",
  connector: "and",
  conditions,
});

const withBanner = (patch: Partial<TBannerForm>): TCreativeEditorForm => ({
  ...readyBanner,
  content: { ...(readyBanner.content as TBannerForm), ...patch },
});

describe("getPublishIssues", () => {
  test("a complete feedback button and a notice-only banner publish", () => {
    expect(getPublishIssues(readyButton)).toEqual([]);
    expect(getPublishIssues(readyBanner)).toEqual([]);
  });

  test("a feedback button needs a name, a label and the survey it opens", () => {
    expect(
      getPublishIssues({
        ...readyButton,
        name: "  ",
        content: { type: "feedbackButton", label: " ", icon: null },
        destination: { type: "survey", surveyId: null },
      })
    ).toEqual(["name_missing", "label_missing", "survey_missing"]);
  });

  test("a banner needs a message with text, and a button needs a label and a Destination", () => {
    expect(getPublishIssues(withBanner({ message: [{ text: "  " }] }))).toEqual(["message_missing"]);
    expect(getPublishIssues(withBanner({ hasButton: true, buttonLabel: "" }))).toEqual([
      "button_label_missing",
      "survey_missing",
    ]);
  });

  test("a link Destination must be a full http(s) link", () => {
    const link = (url: string): TCreativeEditorForm => ({
      ...readyButton,
      destination: { type: "link", url },
    });

    expect(getPublishIssues(link(""))).toEqual(["link_invalid"]);
    expect(getPublishIssues(link("javascript:alert(1)"))).toEqual(["link_invalid"]);
    expect(getPublishIssues(link("www.example.com"))).toEqual(["link_invalid"]);
    expect(getPublishIssues(link(" https://example.com/help "))).toEqual([]);
  });

  test("an end at or before the start blocks Publish", () => {
    const start = new Date("2026-11-01T02:00:00.000Z");
    expect(getPublishIssues({ ...readyButton, schedule: { startAt: start, endAt: start } })).toEqual([
      "end_before_start",
    ]);
    expect(
      getPublishIssues({
        ...readyButton,
        schedule: { startAt: start, endAt: new Date("2026-11-01T04:00:00.000Z") },
      })
    ).toEqual([]);
  });
});

describe("Settings checks", () => {
  test("a creative shown on an action can't publish without one, and is sent to Settings", () => {
    const noAction = withDistribution({ showOn: "action", actionClassIds: [] });

    expect(getPublishIssues(noAction)).toEqual(["action_missing"]);
    expect(PUBLISH_ISSUE_TABS.action_missing).toBe("settings");
    expect(
      getPublishIssues(withDistribution({ showOn: "action", actionClassIds: ["clactionclass00000000001"] }))
    ).toEqual([]);
  });

  test("actions kept from an earlier switch don't count once Every page view is picked", () => {
    expect(getPublishIssues(withDistribution({ showOn: "pageView", actionClassIds: [] }))).toEqual([]);
  });

  test("a draft shown on an action saves without one; a published one doesn't", () => {
    const noAction = withDistribution({ showOn: "action", actionClassIds: [] });

    expect(getSaveIssues(noAction, { published: false })).toEqual([]);
    expect(getSaveIssues(noAction, { published: true })).toEqual(["action_missing"]);
  });

  test("a Show when condition without its value blocks even a draft's save, since the API refuses it", () => {
    const blank = withDistribution({ conditions: showWhen(urlCondition("  ")) });

    expect(getSaveIssues(blank, { published: false })).toEqual(["condition_incomplete"]);
    expect(getPublishIssues(blank)).toEqual(["condition_incomplete"]);
    expect(PUBLISH_ISSUE_TABS.condition_incomplete).toBe("settings");
    expect(getPublishIssues(withDistribution({ conditions: showWhen(urlCondition("/plans")) }))).toEqual([]);
  });
});

describe("getSaveIssues", () => {
  test("a draft with gaps still saves", () => {
    expect(
      getSaveIssues(
        { ...readyButton, content: { type: "feedbackButton", label: "", icon: null } },
        { published: false }
      )
    ).toEqual([]);
    expect(
      getSaveIssues({ ...readyButton, destination: { type: "link", url: "" } }, { published: false })
    ).toEqual([]);
  });

  test("a draft can't be saved without a name, with a broken link, or with an end before the start", () => {
    const start = new Date("2026-11-01T02:00:00.000Z");
    expect(
      getSaveIssues(
        {
          ...readyButton,
          name: "",
          destination: { type: "link", url: "example" },
          schedule: { startAt: start, endAt: new Date("2026-10-31T02:00:00.000Z") },
        },
        { published: false }
      )
    ).toEqual(["name_missing", "link_invalid", "end_before_start"]);
  });

  test("a published creative saves only what it could publish", () => {
    const unlabelled: TCreativeEditorForm = {
      ...readyButton,
      content: { type: "feedbackButton", label: "", icon: null },
    };
    expect(getSaveIssues(unlabelled, { published: true })).toEqual(["label_missing"]);
  });
});

describe("getInvalidParamTab", () => {
  test("sends each refused field of a v3 write to the tab that edits it", () => {
    expect(getInvalidParamTab("content.label.en-US")).toBe("content");
    expect(getInvalidParamTab("destination.surveyId")).toBe("content");
    expect(getInvalidParamTab("defaultLanguage")).toBe("language");
    expect(getInvalidParamTab("languages[0].code")).toBe("language");
    expect(getInvalidParamTab("styling.theme.fontSize.desktop")).toBe("styling");
    expect(getInvalidParamTab("distribution.triggers")).toBe("settings");
    expect(getInvalidParamTab("schedule.endAt")).toBe("schedule");
    expect(getInvalidParamTab("name")).toBeNull();
    expect(getInvalidParamTab("status")).toBeNull();
  });
});
