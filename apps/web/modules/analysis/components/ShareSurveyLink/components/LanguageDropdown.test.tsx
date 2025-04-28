import { getEnabledLanguages } from "@/lib/i18n/utils";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { LanguageDropdown } from "./LanguageDropdown";

vi.mock("@/lib/i18n/utils", () => ({
  getEnabledLanguages: vi.fn(),
}));

vi.mock("@formbricks/i18n-utils/src/utils", () => ({
  getLanguageLabel: vi.fn(),
}));

describe("LanguageDropdown", () => {
  const dummySurveyMultiple = {
    languages: [
      { language: { code: "en" } } as TSurveyLanguage,
      { language: { code: "fr" } } as TSurveyLanguage,
    ],
  } as TSurvey;
  const dummySurveySingle = {
    languages: [{ language: { code: "en" } }],
  } as TSurvey;
  const dummyLocale = "en-US";
  const setLanguageMock = vi.fn();

  afterEach(() => {
    cleanup();
  });

  test("renders nothing when enabledLanguages length is 1", () => {
    vi.mocked(getEnabledLanguages).mockReturnValueOnce([{ language: { code: "en" } } as TSurveyLanguage]);
    render(
      <LanguageDropdown survey={dummySurveySingle} setLanguage={setLanguageMock} locale={dummyLocale} />
    );
    // Since enabledLanguages.length === 1, component should render null.
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("renders button and toggles dropdown when multiple languages exist", async () => {
    vi.mocked(getEnabledLanguages).mockReturnValue(dummySurveyMultiple.languages);
    vi.mocked(getLanguageLabel).mockImplementation((code: string, _locale: string) => code.toUpperCase());

    render(
      <LanguageDropdown survey={dummySurveyMultiple} setLanguage={setLanguageMock} locale={dummyLocale} />
    );

    const button = screen.getByRole("button", { name: "Select Language" });
    expect(button).toBeDefined();

    await userEvent.click(button);
    // Wait for the dropdown options to appear. They are wrapped in a div with no specific role,
    // so we query for texts (our mock labels) instead.
    const optionEn = await screen.findByText("EN");
    const optionFr = await screen.findByText("FR");

    expect(optionEn).toBeDefined();
    expect(optionFr).toBeDefined();

    await userEvent.click(optionFr);
    expect(setLanguageMock).toHaveBeenCalledWith("fr");

    // After clicking, dropdown should no longer be visible.
    await waitFor(() => {
      expect(screen.queryByText("EN")).toBeNull();
      expect(screen.queryByText("FR")).toBeNull();
    });
  });

  test("closes dropdown when clicking outside", async () => {
    vi.mocked(getEnabledLanguages).mockReturnValue(dummySurveyMultiple.languages);
    vi.mocked(getLanguageLabel).mockImplementation((code: string, _locale: string) => code);

    render(
      <LanguageDropdown survey={dummySurveyMultiple} setLanguage={setLanguageMock} locale={dummyLocale} />
    );
    const button = screen.getByRole("button", { name: "Select Language" });
    await userEvent.click(button);

    // Confirm dropdown shown
    expect(await screen.findByText("en")).toBeDefined();

    // Simulate clicking outside by dispatching a click event on the container's parent.
    await userEvent.click(document.body);

    // Wait for dropdown to close
    await waitFor(() => {
      expect(screen.queryByText("en")).toBeNull();
    });
  });
});
