import { describe, expect, test } from "vitest";
import type { TCreativeEditorForm, TCreativeLanguagesForm } from "./editor-form";
import {
  addCreativeLanguage,
  getLanguagesMissingFromSurvey,
  getTranslationProgress,
  makeDefaultLanguage,
  removeCreativeLanguage,
  setCreativeLanguageEnabled,
  updateTranslation,
} from "./languages-form";

const NO_TEXTS = { label: "", message: [], buttonLabel: "", accessibleName: "" };

const englishGerman: TCreativeLanguagesForm = {
  defaultLanguage: "en-US",
  others: [{ code: "de-DE", enabled: true }],
  texts: { "de-DE": { ...NO_TEXTS, label: "Feedback geben" } },
};

const buttonForm = (languages: TCreativeLanguagesForm = englishGerman): TCreativeEditorForm => ({
  name: "Site feedback",
  content: { type: "feedbackButton", label: "Feedback", icon: null },
  destination: { type: "survey", surveyId: "survey-1" },
  schedule: { startAt: null, endAt: null },
  languages,
});

const bannerForm = (): TCreativeEditorForm => ({
  name: "Maintenance",
  content: {
    type: "banner",
    message: [{ text: "Down tonight." }],
    hasButton: true,
    buttonLabel: "Status",
    dismissible: true,
    accessibleName: "",
  },
  destination: { type: "link", url: "https://example.com/status" },
  schedule: { startAt: null, endAt: null },
  languages: {
    defaultLanguage: "en-US",
    others: [{ code: "de-DE", enabled: true }],
    texts: { "de-DE": { ...NO_TEXTS, message: [{ text: "Heute Nacht offline." }] } },
  },
});

describe("languages in the Language tab", () => {
  test("adding a language starts it visible and untranslated; adding it twice changes nothing", () => {
    const added = addCreativeLanguage(englishGerman, "fr-FR");

    expect(added.others).toEqual([
      { code: "de-DE", enabled: true },
      { code: "fr-FR", enabled: true },
    ]);
    expect(added.texts["fr-FR"]).toEqual(NO_TEXTS);
    expect(addCreativeLanguage(added, "fr-FR")).toEqual(added);
    expect(addCreativeLanguage(added, "en-US")).toEqual(added);
  });

  test("hiding a language keeps its translation; removing it drops it", () => {
    const hidden = setCreativeLanguageEnabled(englishGerman, "de-DE", false);
    const removed = removeCreativeLanguage(englishGerman, "de-DE");

    expect(hidden.others).toEqual([{ code: "de-DE", enabled: false }]);
    expect(hidden.texts["de-DE"].label).toBe("Feedback geben");
    expect(removed).toEqual({ defaultLanguage: "en-US", others: [], texts: {} });
  });

  test("a translation is edited field by field", () => {
    const edited = updateTranslation(englishGerman, "de-DE", { label: "Ihre Meinung" });

    expect(edited.texts["de-DE"]).toEqual({ ...NO_TEXTS, label: "Ihre Meinung" });
  });

  test("making a language the default swaps its texts with the default's, which stays as a language", () => {
    const form = makeDefaultLanguage(bannerForm(), "de-DE");

    expect(form.content).toEqual(
      expect.objectContaining({ message: [{ text: "Heute Nacht offline." }], buttonLabel: "" })
    );
    expect(form.languages).toEqual({
      defaultLanguage: "de-DE",
      others: [{ code: "en-US", enabled: true }],
      texts: { "en-US": { ...NO_TEXTS, message: [{ text: "Down tonight." }], buttonLabel: "Status" } },
    });
  });

  test("progress counts the texts the creative has: a banner's button and Accessible name only when set", () => {
    expect(getTranslationProgress(buttonForm(), "de-DE")).toEqual({ translated: 1, total: 1 });
    expect(getTranslationProgress(bannerForm(), "de-DE")).toEqual({ translated: 1, total: 2 });

    const named = bannerForm();
    if (named.content.type === "banner") named.content.accessibleName = "Service notice";
    expect(getTranslationProgress(named, "de-DE")).toEqual({ translated: 1, total: 3 });
  });
});

describe("getLanguagesMissingFromSurvey", () => {
  const surveyLanguage = (
    code: string,
    { isDefault = false, enabled = true, alias = null as string | null } = {}
  ) => ({
    default: isDefault,
    enabled,
    language: { code, alias },
  });
  const englishSpanishApp = {
    type: "app" as const,
    languages: [surveyLanguage("en-US", { isDefault: true }), surveyLanguage("es-ES")],
  };

  test("hides the creative for its languages a multi-language app survey lacks", () => {
    expect(getLanguagesMissingFromSurvey(englishGerman, englishSpanishApp)).toEqual({
      codes: ["de-DE"],
      effect: "hidden",
    });
  });

  test("a link survey, or an app survey in one language, opens in its default language instead", () => {
    expect(getLanguagesMissingFromSurvey(englishGerman, { ...englishSpanishApp, type: "link" })).toEqual({
      codes: ["de-DE"],
      effect: "defaultLanguage",
    });
    expect(
      getLanguagesMissingFromSurvey(englishGerman, {
        type: "app",
        languages: [surveyLanguage("en-US", { isDefault: true })],
      })
    ).toEqual({ codes: ["de-DE"], effect: "defaultLanguage" });
  });

  test("matches as the SDK does: a legacy code or another region of the same language counts", () => {
    const legacyGerman = {
      type: "app" as const,
      languages: [surveyLanguage("en-US", { isDefault: true }), surveyLanguage("de")],
    };
    const austrian = {
      ...legacyGerman,
      languages: [surveyLanguage("en-GB", { isDefault: true }), surveyLanguage("de-AT")],
    };

    expect(getLanguagesMissingFromSurvey(englishGerman, legacyGerman)).toBeNull();
    expect(getLanguagesMissingFromSurvey(englishGerman, austrian)).toBeNull();
  });

  test("leaves out the creative's hidden languages and the survey's disabled ones count as missing", () => {
    const disabledGerman = {
      type: "app" as const,
      languages: [surveyLanguage("en-US", { isDefault: true }), surveyLanguage("de-DE", { enabled: false })],
    };

    expect(
      getLanguagesMissingFromSurvey(
        setCreativeLanguageEnabled(englishGerman, "de-DE", false),
        englishSpanishApp
      )
    ).toBeNull();
    expect(getLanguagesMissingFromSurvey(englishGerman, disabledGerman)).toEqual({
      codes: ["de-DE"],
      effect: "hidden",
    });
  });

  test("says nothing when the survey's languages are unknown or it was never translated", () => {
    expect(getLanguagesMissingFromSurvey(englishGerman, null)).toBeNull();
    expect(getLanguagesMissingFromSurvey(englishGerman, { type: "app", languages: [] })).toBeNull();
  });
});
