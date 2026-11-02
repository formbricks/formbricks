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
});
