/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { type i18n as I18n, createInstance } from "i18next";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useAppLocale } from "./use-app-locale";

/**
 * A switch superseded before its locale bundle loads (ENG-3170). This is a race inside i18next itself,
 * so it runs against a REAL instance rather than a model of one: `changeLanguage` applies a language
 * only once its bundle has loaded, and only if no later `changeLanguage` call has been made since.
 * The backend hands every bundle out through a promise the test resolves, which is what lets a test
 * hold one locale's bundle in flight while the respondent picks another.
 */
const pendingBundles = new Map<string, () => void>();

const createI18n = async () => {
  const instance = createInstance();
  await instance
    .use({
      type: "backend",
      init: () => undefined,
      read: (language: string, _namespace: string, callback: (err: null, data: object) => void) => {
        // The root locale's bundle is already loaded by the time any survey renders.
        if (language === "en-US") return callback(null, { greeting: language });
        pendingBundles.set(language, () => callback(null, { greeting: language }));
      },
    })
    .init({ lng: "en-US", fallbackLng: false, load: "currentOnly" });
  return instance;
};

let i18n: I18n;

/** i18next asks the backend for a bundle asynchronously, a tick after `changeLanguage` is called. */
const waitForBundleRequest = (language: string) =>
  waitFor(() => {
    expect(pendingBundles.has(language)).toBe(true);
  });

const loadBundle = async (language: string) => {
  const load = pendingBundles.get(language);
  if (!load) throw new Error(`no ${language} bundle was requested`);
  pendingBundles.delete(language);
  await act(async () => load());
};

vi.mock("react-i18next", () => ({
  useTranslation: () => {
    // Re-render on every language change, as react-i18next does.
    useSyncExternalStore(
      (notify: () => void) => {
        i18n.on("languageChanged", notify);
        return () => i18n.off("languageChanged", notify);
      },
      () => i18n.language,
      () => i18n.language
    );
    return { i18n };
  },
}));

beforeEach(async () => {
  pendingBundles.clear();
  i18n = await createI18n();
});

describe("useAppLocale when a switch is superseded before its bundle loads", () => {
  test("switching back to the current language cancels the abandoned switch", async () => {
    const { rerender } = renderHook(({ locale }) => useAppLocale(locale), {
      initialProps: { locale: "en-US" },
    });

    // The respondent picks Deutsch; its bundle is still downloading…
    rerender({ locale: "de-DE" });
    await waitForBundleRequest("de-DE");
    expect(i18n.language).toBe("en-US");

    // …so they change their mind and pick English again.
    rerender({ locale: "en-US" });
    await act(async () => {});

    // The German bundle arrives late. Nothing on screen asks for German any more.
    await loadBundle("de-DE");

    expect(i18n.language).toBe("en-US");
  });

  test("a later switch to a third language wins whichever bundle lands first", async () => {
    const { rerender } = renderHook(({ locale }) => useAppLocale(locale), {
      initialProps: { locale: "en-US" },
    });

    rerender({ locale: "de-DE" });
    await waitForBundleRequest("de-DE");
    rerender({ locale: "fr-FR" });
    await waitForBundleRequest("fr-FR");

    await loadBundle("fr-FR");
    await loadBundle("de-DE");

    expect(i18n.language).toBe("fr-FR");
  });
});
