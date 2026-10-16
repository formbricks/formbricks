import { describe, expect, test } from "vitest";
import { DEFAULT_CREATIVE_STYLE } from "@formbricks/creatives";
import type { TCreativeEditorForm } from "./editor-form";
import { toPreviewView } from "./preview-view";

const schedule = { startAt: null, endAt: null };
const theme = {
  customStyles: false,
  backgroundColor: null,
  textColor: null,
  borderColor: null,
  fontWeight: null,
  fontSize: { desktop: null, phone: null },
  paddingX: { desktop: null, phone: null },
  paddingY: { desktop: null, phone: null },
};

const bannerForm = (content: Partial<Extract<TCreativeEditorForm["content"], { type: "banner" }>>) =>
  ({
    name: "Maintenance",
    content: {
      type: "banner",
      message: [{ text: "Down tonight", bold: true }],
      hasButton: true,
      buttonLabel: "Status",
      dismissible: true,
      accessibleName: "",
      ...content,
    },
    destination: { type: "link", url: "https://example.com/status" },
    styling: {
      type: "banner",
      position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
      theme,
    },
    schedule,
  }) satisfies TCreativeEditorForm;

describe("preview view", () => {
  test("a feedback button shows the label being typed, at its position, in the computed look", () => {
    const form: TCreativeEditorForm = {
      name: "Site feedback",
      content: { type: "feedbackButton", label: "Tell us", icon: "megaphone" },
      destination: { type: "survey", surveyId: null },
      styling: {
        type: "feedbackButton",
        position: { desktop: { edge: "right", offset: 60 }, phone: { edge: "bottom", offset: 90 } },
        theme: { ...theme, borderRadius: null },
      },
      schedule,
    };

    expect(toPreviewView("clcreative00000000000001", form, DEFAULT_CREATIVE_STYLE)).toMatchObject({
      id: "clcreative00000000000001",
      type: "feedbackButton",
      label: "Tell us",
      icon: "megaphone",
      position: { desktop: { edge: "right", offset: 60 }, phone: { edge: "bottom", offset: 90 } },
      style: DEFAULT_CREATIVE_STYLE,
    });
  });

  test("a banner shows its text runs and button, and a blank accessible name means the default", () => {
    expect(toPreviewView("clcreative00000000000002", bannerForm({}), DEFAULT_CREATIVE_STYLE)).toMatchObject({
      type: "banner",
      message: [{ text: "Down tonight", bold: true }],
      buttonLabel: "Status",
      dismissible: true,
      accessibleName: null,
      position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
    });
  });

  test("a banner with its button switched off shows no button and opens nothing", () => {
    const view = toPreviewView(
      "clcreative00000000000002",
      bannerForm({ hasButton: false, accessibleName: " Service notice " }),
      DEFAULT_CREATIVE_STYLE
    );

    expect(view).toMatchObject({ buttonLabel: null, destination: null, accessibleName: "Service notice" });
  });
});
