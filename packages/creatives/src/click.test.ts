import { describe, expect, test } from "vitest";
import { resolveClick } from "./click";
import { DEFAULT_CREATIVE_STYLE } from "./style";
import type { TCreativeDestination, TFeedbackButtonView } from "./types";

const buttonOpening = (destination: TCreativeDestination): TFeedbackButtonView => ({
  id: "creative-1",
  type: "feedbackButton",
  label: "Feedback",
  icon: null,
  position: { desktop: { edge: "right", offset: 50 }, phone: null },
  style: DEFAULT_CREATIVE_STYLE,
  destination,
});

const popup = buttonOpening({ type: "survey", surveyId: "survey-1", opensAs: "popup" });

describe("resolveClick", () => {
  test("opens its popup survey when no survey is open", () => {
    expect(resolveClick(popup, [])).toEqual({ kind: "openSurvey", surveyId: "survey-1", close: [] });
  });

  test("does nothing while its own survey is already open", () => {
    expect(resolveClick(popup, ["survey-1"])).toEqual({ kind: "none" });
  });

  test("closes a different open survey, then opens its own", () => {
    expect(resolveClick(popup, ["survey-2"])).toEqual({
      kind: "openSurvey",
      surveyId: "survey-1",
      close: ["survey-2"],
    });
  });

  test("opens a link survey in a new tab, telling it which creative opened it", () => {
    const linkSurvey = buttonOpening({
      type: "survey",
      surveyId: "survey-3",
      opensAs: "newTab",
      url: "https://app.formbricks.com/s/survey-3?lang=de",
    });

    expect(resolveClick(linkSurvey, ["survey-2"])).toEqual({
      kind: "openTab",
      url: "https://app.formbricks.com/s/survey-3?lang=de&creativeId=creative-1",
    });
  });

  test("opens a link in a new tab as it was given", () => {
    const link = buttonOpening({ type: "link", url: "https://example.com/help?topic=billing" });

    expect(resolveClick(link, [])).toEqual({
      kind: "openTab",
      url: "https://example.com/help?topic=billing",
    });
  });

  test("does nothing for a banner without a button", () => {
    const notice = {
      id: "banner-1",
      type: "banner" as const,
      message: [],
      buttonLabel: null,
      dismissible: false,
      accessibleName: null,
      position: { desktop: { placement: "top" as const, layout: "inPage" as const }, phone: null },
      style: DEFAULT_CREATIVE_STYLE,
      destination: null,
    };

    expect(resolveClick(notice, [])).toEqual({ kind: "none" });
  });
});
