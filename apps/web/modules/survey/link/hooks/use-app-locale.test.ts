/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useAppLocale } from "./use-app-locale";

const i18n = {
  language: "en-US",
  changeLanguage: vi.fn(),
};

/**
 * The two things about `useTranslation` this hook actually depends on, modelled rather than stubbed
 * away: every consumer re-renders when the language changes, and each one is handed a NEW `i18n`
 * wrapper object when it does (react-i18next's own `createI18nWrapper`, keyed on `language`). The
 * identity a caller sees is language-scoped, not stable — which is what ENG-3160 turned on.
 */
const languageListeners = new Set<() => void>();
let i18nWrapper: typeof i18n = i18n;
let wrapperLanguage = i18n.language;

const currentI18n = (): typeof i18n => {
  if (wrapperLanguage !== i18n.language) {
    wrapperLanguage = i18n.language;
    i18nWrapper = Object.create(Object.getPrototypeOf(i18n), Object.getOwnPropertyDescriptors(i18n));
  }
  return i18nWrapper;
};

const setLanguage = (next: string) => {
  i18n.language = next;
  for (const notify of languageListeners) notify();
};

vi.mock("react-i18next", () => ({
  useTranslation: () => {
    useSyncExternalStore(
      (notify: () => void) => {
        languageListeners.add(notify);
        return () => languageListeners.delete(notify);
      },
      () => i18n.language,
      () => i18n.language
    );
    return { i18n: currentI18n() };
  },
}));

/** Resolves like i18next does: the language is live only once the promise settles. */
const changeLanguageSucceeds = () => {
  i18n.changeLanguage.mockImplementation(async (next: string) => {
    setLanguage(next);
  });
};

beforeEach(() => {
  i18n.language = "en-US";
  wrapperLanguage = "en-US";
  i18nWrapper = i18n;
  languageListeners.clear();
  i18n.changeLanguage.mockReset();
  changeLanguageSucceeds();
});

describe("useAppLocale", () => {
  test("waits for the requested locale before reporting ready", async () => {
    let applyLocale: (() => void) | undefined;
    i18n.changeLanguage.mockImplementation(
      (next: string) =>
        new Promise<void>((resolve) => {
          applyLocale = () => {
            setLanguage(next);
            resolve();
          };
        })
    );

    const { result } = renderHook(() => useAppLocale("de-DE"));

    expect(result.current).toBe(false);
    expect(i18n.changeLanguage).toHaveBeenCalledWith("de-DE");

    applyLocale?.();

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(i18n.language).toBe("de-DE");
  });

  test("is ready on the first render when i18n already sits on the locale", () => {
    const { result } = renderHook(() => useAppLocale("en-US"));

    expect(result.current).toBe(true);
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  test("reports ready after falling back, so a waiting caller is never left blank", async () => {
    i18n.changeLanguage.mockImplementation(async (next: string) => {
      if (next === "he") throw new Error("no bundle for he");
      setLanguage(next);
    });

    const { result } = renderHook(() => useAppLocale("he"));

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(i18n.changeLanguage).toHaveBeenNthCalledWith(2, "en-US");
  });

  test("stays ready across a later switch, so the survey shell does not blank", async () => {
    const { result, rerender } = renderHook(({ locale }) => useAppLocale(locale), {
      initialProps: { locale: "en-US" },
    });

    expect(result.current).toBe(true);

    rerender({ locale: "fr-FR" });

    expect(result.current).toBe(true);
    await waitFor(() => {
      expect(i18n.changeLanguage).toHaveBeenCalledWith("fr-FR");
    });
  });

  test("a gate still mounted behind the survey does not fight the in-survey language switch", async () => {
    // A PIN-protected survey keeps both alive at once: PinScreen holds the locale its gate was
    // resolved in, and renders SurveyClientWrapper — which follows the language picker — beneath it.
    // Each switch used to make the gate re-apply its own locale, the survey re-apply its new one, and
    // so on until React aborted the render tree onto the app's error boundary (ENG-3160).
    //
    // Capped so a regression starves instead of hanging the suite; the assertion is on the calls.
    i18n.changeLanguage.mockImplementation(async (next: string) => {
      if (i18n.changeLanguage.mock.calls.length > 10) return;
      setLanguage(next);
    });

    const { rerender } = renderHook(
      ({ surveyLocale }: { surveyLocale: string }) => {
        useAppLocale("en-US");
        useAppLocale(surveyLocale);
      },
      { initialProps: { surveyLocale: "en-US" } }
    );

    expect(i18n.changeLanguage).not.toHaveBeenCalled();

    rerender({ surveyLocale: "de-DE" });

    await waitFor(() => {
      expect(i18n.changeLanguage).toHaveBeenCalledWith("de-DE");
    });
    // Drain any further effect pass before asserting that none fired. Each act() flushes the
    // microtask queue the mock settles on, so a ping-pong round cannot slip through the way it could
    // hide behind a fixed wall-clock margin on a loaded runner.
    await act(async () => {});
    await act(async () => {});
    await act(async () => {});

    expect(i18n.changeLanguage).toHaveBeenCalledExactlyOnceWith("de-DE");
    expect(i18n.language).toBe("de-DE");
  });

  test("a survey mounting behind a settled gate wins once, and the gate does not answer back", async () => {
    // The order the reported crash actually takes, which the test above does not cover: the gate
    // resolves first and settles on its own locale (with no ?lang= that is the Accept-Language one),
    // and SurveyClientWrapper mounts later on the survey's default language. They differ routinely.
    // The later mount must win exactly once, and the settled gate must not re-assert its own locale.
    i18n.changeLanguage.mockImplementation(async (next: string) => {
      if (i18n.changeLanguage.mock.calls.length > 10) return;
      setLanguage(next);
    });
    setLanguage("fr-FR");

    const gate = renderHook(() => useAppLocale("fr-FR"));

    await waitFor(() => {
      expect(gate.result.current).toBe(true);
    });
    expect(i18n.changeLanguage).not.toHaveBeenCalled();

    const survey = renderHook(() => useAppLocale("en-US"));

    await waitFor(() => {
      expect(survey.result.current).toBe(true);
    });
    await act(async () => {});
    await act(async () => {});

    expect(i18n.changeLanguage).toHaveBeenCalledExactlyOnceWith("en-US");
    expect(i18n.language).toBe("en-US");
  });
});
