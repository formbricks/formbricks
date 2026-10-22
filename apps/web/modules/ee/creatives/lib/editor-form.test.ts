import { describe, expect, test } from "vitest";
import { zCreateCreativeRequest, zCreativeResource } from "@formbricks/api-v3-schemas";
import {
  type TCreativeEditorForm,
  buildCreativePatch,
  buildNewCreativeRequest,
  stopsOpeningSurvey,
  toCreativeEditorForm,
} from "./editor-form";
import {
  addCreativeLanguage,
  makeDefaultLanguage,
  removeCreativeLanguage,
  updateTranslation,
} from "./languages-form";
import type { TCreativeStylingForm } from "./styling-form";

// Fixtures go through the contract's own schema, so they are resources a GET could return.
const base = {
  id: "clcreative00000000000001",
  workspaceId: "clworkspace0000000000001",
  name: "Site feedback",
  status: "draft",
  displayStatus: "draft",
  displayStatusReason: null,
  createdAt: "2026-10-16T08:00:00.000Z",
  updatedAt: "2026-10-16T08:00:00.000Z",
  publishedAt: null,
  archivedAt: null,
  creator: { name: "Dana" },
  defaultLanguage: "en-US",
  languages: [
    { code: "en-US", default: true, enabled: true },
    { code: "de-DE", default: false, enabled: true },
  ],
  distribution: { showOn: "pageView", triggers: [], conditions: null, displayPercentage: null },
  schedule: { startAt: null, endAt: null },
  warnings: [],
};

const feedbackButton = zCreativeResource.parse({
  ...base,
  type: "feedbackButton",
  content: { label: { "en-US": "Feedback", "de-DE": "Feedback geben" }, icon: "messageSquare" },
  styling: {
    position: { desktop: { edge: "right", offset: 50 }, phone: null },
    theme: {
      customStyles: false,
      backgroundColor: null,
      textColor: null,
      borderColor: null,
      borderRadius: null,
      fontWeight: null,
      fontSize: { desktop: null, phone: null },
      paddingX: { desktop: null, phone: null },
      paddingY: { desktop: null, phone: null },
    },
  },
  destination: {
    type: "survey",
    surveyId: "clsurvey0000000000000001",
    surveyName: "Site survey",
    opensAs: "popup",
  },
});

const banner = zCreativeResource.parse({
  ...base,
  name: "Maintenance",
  type: "banner",
  content: {
    message: {
      "en-US": [{ text: "Down tonight. " }, { text: "Details", href: "/maintenance", underline: true }],
      "de-DE": [{ text: "Heute Nacht offline." }],
    },
    button: { label: { "en-US": "Learn more", "de-DE": "Mehr" } },
    dismissible: true,
    accessibleName: null,
  },
  styling: {
    position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
    theme: {
      customStyles: false,
      backgroundColor: null,
      textColor: null,
      borderColor: null,
      fontWeight: null,
      fontSize: { desktop: null, phone: null },
      paddingX: { desktop: null, phone: null },
      paddingY: { desktop: null, phone: null },
    },
  },
  destination: { type: "link", url: "https://example.com/status", opensAs: "newTab" },
});

describe("banner form", () => {
  test("reads the default-language message, button and accessible name, and sends them back unchanged", () => {
    const form = toCreativeEditorForm(banner);

    expect(form.content).toEqual({
      type: "banner",
      message: [{ text: "Down tonight. " }, { text: "Details", href: "/maintenance", underline: true }],
      hasButton: true,
      buttonLabel: "Learn more",
      dismissible: true,
      accessibleName: "",
    });
    expect(buildCreativePatch(form, banner, "save")).toMatchObject({
      content: banner.content,
      destination: { type: "link", url: "https://example.com/status" },
      styling: { position: banner.styling.position, theme: banner.styling.theme },
    });
  });

  test("turning the button off sends no button and no Destination, the chosen one kept in the form", () => {
    const form = toCreativeEditorForm(banner);
    const withoutButton = { ...form, content: { ...form.content, hasButton: false } };

    expect(buildCreativePatch(withoutButton, banner, "save")).toMatchObject({
      content: { button: null },
      destination: null,
    });
    expect(withoutButton.destination).toEqual({ type: "link", url: "https://example.com/status" });
  });

  test("an accessible name is sent per language only when written; blank falls back to the default", () => {
    const form = toCreativeEditorForm(banner);
    const named = { ...form, content: { ...form.content, accessibleName: " Service notice " } };
    const blank = { ...form, content: { ...form.content, accessibleName: "   " } };

    expect(buildCreativePatch(named, banner, "save").content).toMatchObject({
      accessibleName: { "en-US": "Service notice" },
    });
    expect(buildCreativePatch(blank, banner, "save").content).toMatchObject({ accessibleName: null });
  });

  test("an edited message and button label replace only the default language", () => {
    const form = toCreativeEditorForm(banner);
    const edited = {
      ...form,
      content: { ...form.content, message: [{ text: "Back at 04:00", bold: true }], buttonLabel: "Status" },
    };

    expect(buildCreativePatch(edited, banner, "save").content).toMatchObject({
      message: {
        "en-US": [{ text: "Back at 04:00", bold: true }],
        "de-DE": [{ text: "Heute Nacht offline." }],
      },
      button: { label: { "en-US": "Status", "de-DE": "Mehr" } },
    });
  });
});

describe("stopsOpeningSurvey", () => {
  test("a save that keeps the survey keeps opening it", () => {
    const form = toCreativeEditorForm(feedbackButton);

    expect(stopsOpeningSurvey(feedbackButton, buildCreativePatch(form, feedbackButton, "save"))).toBe(false);
  });

  test("a save that picks a link or another survey stops opening the one it had", () => {
    const form = toCreativeEditorForm(feedbackButton);
    const relinked = (destination: TCreativeEditorForm["destination"]) =>
      stopsOpeningSurvey(
        feedbackButton,
        buildCreativePatch({ ...form, destination }, feedbackButton, "save")
      );

    expect(relinked({ type: "link", url: "https://example.com/help" })).toBe(true);
    expect(relinked({ type: "survey", surveyId: "clsurvey0000000000000002" })).toBe(true);
  });

  test("a creative that opens no survey has none to stop opening", () => {
    const linkButton = zCreativeResource.parse({
      ...feedbackButton,
      destination: { type: "link", url: "https://example.com/help", opensAs: "newTab" },
    });
    const form = toCreativeEditorForm(linkButton);

    expect(stopsOpeningSurvey(linkButton, buildCreativePatch(form, linkButton, "save"))).toBe(false);
  });
});

describe("feedback button form", () => {
  test("saving an untouched creative sends back what it read, the other languages included", () => {
    const form = toCreativeEditorForm(feedbackButton);

    expect(buildCreativePatch(form, feedbackButton, "save")).toEqual({
      name: "Site feedback",
      content: { label: { "en-US": "Feedback", "de-DE": "Feedback geben" }, icon: "messageSquare" },
      destination: { type: "survey", surveyId: "clsurvey0000000000000001" },
      styling: {
        position: { desktop: { edge: "right", offset: 50 }, phone: null },
        theme: {
          customStyles: false,
          backgroundColor: null,
          textColor: null,
          borderColor: null,
          borderRadius: null,
          fontWeight: null,
          fontSize: { desktop: null, phone: null },
          paddingX: { desktop: null, phone: null },
          paddingY: { desktop: null, phone: null },
          pageFont: null,
          customCss: null,
        },
      },
      distribution: { showOn: "pageView", triggers: [], conditions: null, displayPercentage: null },
      schedule: { startAt: null, endAt: null },
    });
  });

  test("custom styles go out whole, with the Custom CSS a field per appearance and blank fields as none", () => {
    const styling: TCreativeStylingForm = {
      type: "feedbackButton",
      position: { desktop: { edge: "bottom", offset: 80 }, phone: { edge: "left", offset: 40 } },
      theme: {
        customStyles: true,
        backgroundColor: { light: "#f59e0b", dark: "#78350f" },
        textColor: null,
        borderColor: null,
        borderRadius: 12,
        fontWeight: 700,
        fontSize: { desktop: 16, phone: 14 },
        paddingX: { desktop: null, phone: null },
        paddingY: { desktop: null, phone: 6 },
        pageFont: false,
        customCss: { light: "  ", dark: ".fb-creative-button { color: #fff; }" },
      },
    };
    const styled: TCreativeEditorForm = { ...toCreativeEditorForm(feedbackButton), styling };
    const cleared: TCreativeEditorForm = {
      ...styled,
      styling: { ...styling, theme: { ...styling.theme, customCss: { light: "", dark: " \n" } } },
    };

    expect(buildCreativePatch(styled, feedbackButton, "save").styling).toEqual({
      position: { desktop: { edge: "bottom", offset: 80 }, phone: { edge: "left", offset: 40 } },
      theme: {
        customStyles: true,
        backgroundColor: { light: "#f59e0b", dark: "#78350f" },
        textColor: null,
        borderColor: null,
        borderRadius: 12,
        fontWeight: 700,
        fontSize: { desktop: 16, phone: 14 },
        paddingX: { desktop: null, phone: null },
        paddingY: { desktop: null, phone: 6 },
        pageFont: false,
        customCss: { light: null, dark: ".fb-creative-button { color: #fff; }" },
      },
    });
    expect(buildCreativePatch(cleared, feedbackButton, "save").styling?.theme).toMatchObject({
      customCss: null,
    });
  });

  test("an edited label replaces only the default language, and the schedule goes out as ISO instants", () => {
    const form = toCreativeEditorForm(feedbackButton);
    const edited = {
      ...form,
      name: "  Site feedback tab ",
      content: { type: "feedbackButton" as const, label: "Tell us", icon: null },
      schedule: {
        startAt: new Date("2026-11-01T02:00:00.000Z"),
        endAt: new Date("2026-11-01T04:00:00.000Z"),
      },
    };

    expect(buildCreativePatch(edited, feedbackButton, "save")).toMatchObject({
      name: "Site feedback tab",
      content: { label: { "en-US": "Tell us", "de-DE": "Feedback geben" }, icon: null },
      schedule: { startAt: "2026-11-01T02:00:00.000Z", endAt: "2026-11-01T04:00:00.000Z" },
    });
  });

  test("publishing sets the status to Active's stored word; saving leaves the status alone", () => {
    const form = toCreativeEditorForm(feedbackButton);

    expect(buildCreativePatch(form, feedbackButton, "publish")).toMatchObject({ status: "inProgress" });
    expect(buildCreativePatch(form, feedbackButton, "save")).not.toHaveProperty("status");
  });

  test("a survey not chosen yet or an empty link is sent as no Destination", () => {
    const form = toCreativeEditorForm(feedbackButton);

    expect(
      buildCreativePatch({ ...form, destination: { type: "survey", surveyId: null } }, feedbackButton, "save")
        .destination
    ).toBeNull();
    expect(
      buildCreativePatch({ ...form, destination: { type: "link", url: "  " } }, feedbackButton, "save")
        .destination
    ).toBeNull();
    expect(
      buildCreativePatch(
        { ...form, destination: { type: "link", url: " https://example.com/help " } },
        feedbackButton,
        "save"
      ).destination
    ).toEqual({ type: "link", url: "https://example.com/help" });
  });
});

describe("languages (ENG-4003)", () => {
  test("reads every other language's texts, and an untouched form sends no languages", () => {
    const form = toCreativeEditorForm(banner);

    expect(form.languages).toEqual({
      defaultLanguage: "en-US",
      others: [{ code: "de-DE", enabled: true }],
      texts: {
        "de-DE": {
          label: "",
          message: [{ text: "Heute Nacht offline." }],
          buttonLabel: "Mehr",
          accessibleName: "",
        },
      },
    });
    expect(buildCreativePatch(form, banner, "save")).not.toHaveProperty("languages");
    expect(buildCreativePatch(form, banner, "save")).not.toHaveProperty("defaultLanguage");
  });

  test("a translation goes out under its language code; a blank one is left out, so visitors get the default", () => {
    const form = toCreativeEditorForm(feedbackButton);
    const blank = addCreativeLanguage(form.languages, "fr-FR");
    const edited = {
      ...form,
      languages: updateTranslation(updateTranslation(blank, "de-DE", { label: "Ihre Meinung" }), "fr-FR", {
        label: "  ",
      }),
    };

    expect(buildCreativePatch(edited, feedbackButton, "save")).toMatchObject({
      defaultLanguage: "en-US",
      languages: [
        { code: "de-DE", enabled: true },
        { code: "fr-FR", enabled: true },
      ],
      content: { label: { "en-US": "Feedback", "de-DE": "Ihre Meinung" } },
    });
    expect(buildCreativePatch(edited, feedbackButton, "save").content).not.toHaveProperty("label.fr-FR");
  });

  test("a removed language takes its texts with it, so none is left undeclared", () => {
    const form = toCreativeEditorForm(banner);
    const removed = { ...form, languages: removeCreativeLanguage(form.languages, "de-DE") };

    expect(buildCreativePatch(removed, banner, "save")).toMatchObject({
      languages: [],
      content: {
        message: { "en-US": form.content.type === "banner" ? form.content.message : [] },
        button: { label: { "en-US": "Learn more" } },
      },
    });
    expect(buildCreativePatch(removed, banner, "save").content).not.toHaveProperty("message.de-DE");
  });

  test("a new default language holds every text, the old default kept as a translation", () => {
    const form = makeDefaultLanguage(toCreativeEditorForm(feedbackButton), "de-DE");

    expect(buildCreativePatch(form, feedbackButton, "save")).toMatchObject({
      defaultLanguage: "de-DE",
      languages: [{ code: "en-US", enabled: true }],
      content: { label: { "de-DE": "Feedback geben", "en-US": "Feedback" } },
    });
  });

  test("an Accessible name is translated only while the default language has one", () => {
    const form = toCreativeEditorForm(banner);
    const translated = {
      ...form,
      languages: updateTranslation(form.languages, "de-DE", { accessibleName: "Hinweis" }),
    };
    const named = { ...translated, content: { ...translated.content, accessibleName: "Service notice" } };

    expect(buildCreativePatch(translated, banner, "save").content).toMatchObject({ accessibleName: null });
    expect(buildCreativePatch(named, banner, "save").content).toMatchObject({
      accessibleName: { "en-US": "Service notice", "de-DE": "Hinweis" },
    });
  });
});

describe("settings form (Show on, Show when, Share of visitors)", () => {
  const conditions = {
    id: "clgroup00000000000000001",
    connector: "or" as const,
    conditions: [
      {
        id: "clcondition0000000000001",
        leftOperand: { type: "page" as const, value: "currentUrl" as const },
        operator: "startsWith" as const,
        rightOperand: { type: "static" as const, value: "https://example.com/plans" },
      },
      {
        id: "clsubgroup00000000000001",
        connector: "and" as const,
        conditions: [
          {
            id: "clcondition0000000000002",
            leftOperand: { type: "device" as const, value: "deviceType" as const },
            operator: "equals" as const,
            rightOperand: { type: "static" as const, value: "phone" },
          },
        ],
      },
    ],
  };

  const onAction = zCreativeResource.parse({
    ...feedbackButton,
    distribution: {
      showOn: "action",
      triggers: [
        { actionClassId: "clactionclass00000000001" },
        { actionClassId: "clactionclass00000000002" },
      ],
      conditions,
      displayPercentage: 25,
    },
  });

  test("reads the stored actions, conditions and share, and sends them back unchanged", () => {
    const form = toCreativeEditorForm(onAction);

    expect(form.distribution).toEqual({
      showOn: "action",
      actionClassIds: ["clactionclass00000000001", "clactionclass00000000002"],
      conditions,
      displayPercentage: 25,
    });
    expect(buildCreativePatch(form, onAction, "save").distribution).toEqual(onAction.distribution);
  });

  test("Every page view sends no actions, and the form keeps them for switching back", () => {
    const form = toCreativeEditorForm(onAction);
    const everyPage: TCreativeEditorForm = {
      ...form,
      distribution: { ...form.distribution, showOn: "pageView" },
    };

    expect(buildCreativePatch(everyPage, onAction, "save").distribution).toMatchObject({
      showOn: "pageView",
      triggers: [],
    });
    expect(everyPage.distribution.actionClassIds).toHaveLength(2);
  });

  test("an edited Show when and Share of visitors go out as edited; everyone is no share", () => {
    const form = toCreativeEditorForm(feedbackButton);
    const edited: TCreativeEditorForm = {
      ...form,
      distribution: { ...form.distribution, conditions, displayPercentage: null },
    };

    expect(buildCreativePatch(edited, feedbackButton, "save").distribution).toEqual({
      showOn: "pageView",
      triggers: [],
      conditions,
      displayPercentage: null,
    });
  });
});

describe("new creative", () => {
  test("a feedback button starts as a Draft with its label in the default language and the message icon", () => {
    const body = buildNewCreativeRequest({
      workspaceId: "clworkspace0000000000001",
      type: "feedbackButton",
      name: "Untitled creative",
      label: "Feedback",
      defaultLanguage: "de-DE",
    });

    expect(body).toEqual({
      workspaceId: "clworkspace0000000000001",
      name: "Untitled creative",
      type: "feedbackButton",
      defaultLanguage: "de-DE",
      content: { label: { "de-DE": "Feedback" }, icon: "messageSquare" },
    });
    expect(zCreateCreativeRequest.safeParse(body).success).toBe(true);
  });

  test("a banner starts as a dismissible notice with no text, no button and the default accessible name", () => {
    const body = buildNewCreativeRequest({
      workspaceId: "clworkspace0000000000001",
      type: "banner",
      name: "Untitled creative",
      label: "Feedback",
      defaultLanguage: "en-US",
    });

    expect(body).toEqual({
      workspaceId: "clworkspace0000000000001",
      name: "Untitled creative",
      type: "banner",
      defaultLanguage: "en-US",
      content: { message: { "en-US": [] }, button: null, dismissible: true, accessibleName: null },
    });
    expect(zCreateCreativeRequest.safeParse(body).success).toBe(true);
  });
});
