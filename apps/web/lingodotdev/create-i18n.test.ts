import { describe, expect, test } from "vitest";
import { createI18n } from "./create-i18n";

describe("createI18n", () => {
  // ENG-3771: react-i18next suspends `useTranslation` until the instance is initialised and the
  // namespace loaded. Both must hold synchronously, or the root layout's tree drops out of the
  // server HTML again.
  test("is ready synchronously, without awaiting init", () => {
    const i18n = createI18n("de-DE", { greeting: "Hallo" });

    expect(i18n.isInitialized).toBe(true);
    expect(i18n.hasLoadedNamespace("translation")).toBe(true);
    expect(i18n.t("greeting")).toBe("Hallo");
  });

  test("keeps instances for different locales apart", () => {
    const en = createI18n("en-US", { greeting: "Hello" });
    const de = createI18n("de-DE", { greeting: "Hallo" });

    expect(en.language).toBe("en-US");
    expect(en.t("greeting")).toBe("Hello");
    expect(de.t("greeting")).toBe("Hallo");
  });

  // A link survey re-points the app at the survey's language (`useAppLocale`); without loading that
  // locale first, every string would render as its raw key.
  test("loads a locale's messages when switching to it", async () => {
    const i18n = createI18n("de-DE", { common: { report_survey: "Umfrage melden" } });

    await i18n.changeLanguage("en-US");

    expect(i18n.language).toBe("en-US");
    expect(i18n.t("common.report_survey")).toBe("Report Survey");
  });

  test("lets the latest switch win when an earlier one is still loading", async () => {
    const i18n = createI18n("en-US", { greeting: "Hello" });

    const slower = i18n.changeLanguage("fr-FR");
    await i18n.changeLanguage("en-US");
    await slower;

    expect(i18n.language).toBe("en-US");
  });

  test("rejects a switch to a locale that does not exist", async () => {
    const i18n = createI18n("en-US", { greeting: "Hello" });

    await expect(i18n.changeLanguage("xx-XX")).rejects.toThrow();
    expect(i18n.language).toBe("en-US");
  });
});
