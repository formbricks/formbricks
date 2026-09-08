/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useAppLocale } from "./use-app-locale";

const i18n = {
  language: "en-US",
  changeLanguage: vi.fn(),
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n }),
}));

/** Resolves like i18next does: the language is live only once the promise settles. */
const changeLanguageSucceeds = () => {
  i18n.changeLanguage.mockImplementation(async (next: string) => {
    i18n.language = next;
  });
};

beforeEach(() => {
  i18n.language = "en-US";
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
            i18n.language = next;
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
      i18n.language = next;
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
});
