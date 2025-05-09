import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { LanguageSwitch } from "./language-switch";

// Mock getLanguageLabel to return the language code
vi.mock("@formbricks/i18n-utils/src", () => ({
  getLanguageLabel: (code: string) => code,
}));

describe("LanguageSwitch", () => {
  const mockSetSelectedLanguageCode = vi.fn();
  const mockSetFirstRender = vi.fn();
  const surveyLanguages: TSurveyLanguage[] = [
    {
      language: {
        id: "en",
        code: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
        alias: null,
        projectId: "project1",
      },
      default: true,
      enabled: true,
    },
    {
      language: {
        id: "es",
        code: "es",
        createdAt: new Date(),
        updatedAt: new Date(),
        alias: null,
        projectId: "project1",
      },
      default: false,
      enabled: true,
    },
    {
      language: {
        id: "fr",
        code: "fr",
        createdAt: new Date(),
        updatedAt: new Date(),
        alias: null,
        projectId: "project1",
      },
      default: false,
      enabled: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("toggles dropdown and lists only enabled languages", () => {
    render(
      <LanguageSwitch
        surveyLanguages={surveyLanguages}
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        setFirstRender={mockSetFirstRender}
      />
    );

    const toggleButton = screen.getByTitle("Language switch");
    // Initially closed
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Open dropdown
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");

    // Only two enabled languages should appear
    // Should display the language codes
    expect(screen.getByText("en")).toBeInTheDocument();
    expect(screen.getByText("es")).toBeInTheDocument();
    expect(screen.queryByText("fr")).toBeNull();
  });

  it("calls setSelectedLanguageCode and setFirstRender correctly", () => {
    render(
      <LanguageSwitch
        surveyLanguages={surveyLanguages}
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        setFirstRender={mockSetFirstRender}
      />
    );

    const toggleButton = screen.getByTitle("Language switch");
    // Open and select default language
    fireEvent.click(toggleButton);
    fireEvent.click(screen.getByText("en"));
    expect(mockSetSelectedLanguageCode).toHaveBeenCalledWith("default");
    expect(mockSetFirstRender).toHaveBeenCalledWith(true);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Open and select non-default language
    fireEvent.click(toggleButton);
    fireEvent.click(screen.getByText("es"));
    expect(mockSetSelectedLanguageCode).toHaveBeenCalledWith("es");
    expect(mockSetFirstRender).toHaveBeenCalledWith(true);
  });
});
