import { getEnabledLanguages } from "@/lib/i18n/utils";
import { headlineToRecall } from "@/lib/utils/recall";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import { TI18nString, TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { MultiLangWrapper } from "./multi-lang-wrapper";

vi.mock("@/lib/i18n/utils", () => ({
  getEnabledLanguages: vi.fn(),
}));

vi.mock("@/lib/utils/recall", () => ({
  headlineToRecall: vi.fn((value) => value),
  recallToHeadline: vi.fn(() => ({ default: "Default translation text" })),
}));

vi.mock("@/modules/ee/multi-language-surveys/components/language-indicator", () => ({
  LanguageIndicator: vi.fn(() => <div data-testid="language-indicator">Language Indicator</div>),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) =>
      key === "environments.project.languages.translate"
        ? "Translate from"
        : key === "environments.project.languages.incomplete_translations"
          ? "Some languages are missing translations"
          : key, // NOSONAR
  }),
}));

describe("MultiLangWrapper", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockRender = vi.fn(({ onChange, children }) => (
    <div>
      <div data-testid="rendered-content">Content</div>
      {children}
      <button data-testid="change-button" onClick={() => onChange("new value")}>
        Change
      </button>
    </div>
  ));

  const mockProps = {
    isTranslationIncomplete: false,
    value: { default: "Test value" } as TI18nString,
    onChange: vi.fn(),
    localSurvey: {
      languages: [
        { language: { code: "en", name: "English" }, default: true },
        { language: { code: "fr", name: "French" }, default: false },
      ],
    } as unknown as TSurvey,
    selectedLanguageCode: "en",
    setSelectedLanguageCode: vi.fn(),
    locale: { language: "en-US" } as const,
    render: mockRender,
  } as any;

  test("renders correctly with single language", () => {
    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { code: "en-US" } as unknown as TLanguage } as unknown as TSurveyLanguage,
    ]);

    render(<MultiLangWrapper {...mockProps} />);

    expect(screen.getByTestId("rendered-content")).toBeInTheDocument();
    expect(screen.queryByTestId("language-indicator")).not.toBeInTheDocument();
  });

  test("renders language indicator when multiple languages are enabled", () => {
    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { code: "en-US" } as unknown as TLanguage } as unknown as TSurveyLanguage,
      { language: { code: "fr-FR" } as unknown as TLanguage } as unknown as TSurveyLanguage,
    ]);

    render(<MultiLangWrapper {...mockProps} />);

    expect(screen.getByTestId("language-indicator")).toBeInTheDocument();
  });

  test("calls onChange when value changes", async () => {
    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { code: "en-US" } as unknown as TLanguage } as unknown as TSurveyLanguage,
    ]);

    render(<MultiLangWrapper {...mockProps} />);

    await userEvent.click(screen.getByTestId("change-button"));

    expect(mockProps.onChange).toHaveBeenCalledWith({
      default: "new value",
    });
  });

  test("shows translation text when non-default language is selected", () => {
    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { code: "en" } as unknown as TLanguage } as unknown as TSurveyLanguage,
      { language: { code: "fr" } as unknown as TLanguage } as unknown as TSurveyLanguage,
    ]);

    render(<MultiLangWrapper {...mockProps} selectedLanguageCode="fr" />);

    expect(screen.getByText(/Translate from/)).toBeInTheDocument();
  });

  test("shows incomplete translation warning when applicable", () => {
    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { code: "en" } as unknown as TLanguage } as unknown as TSurveyLanguage,
      { language: { code: "fr" } as unknown as TLanguage } as unknown as TSurveyLanguage,
    ]);

    render(<MultiLangWrapper {...mockProps} isTranslationIncomplete={true} />);

    expect(screen.getByText("Some languages are missing translations")).toBeInTheDocument();
  });

  test("uses headlineToRecall when recall items and fallbacks are provided", async () => {
    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { code: "en" } as unknown as TLanguage } as unknown as TSurveyLanguage,
    ]);
    const mockRenderWithRecall = vi.fn(({ onChange }) => (
      <div>
        <button data-testid="recall-button" onClick={() => onChange("new value with recall", [], {})}>
          Change with recall
        </button>
      </div>
    ));

    render(<MultiLangWrapper {...mockProps} render={mockRenderWithRecall} />);

    await userEvent.click(screen.getByTestId("recall-button"));

    expect(mockProps.onChange).toHaveBeenCalled();
    expect(headlineToRecall).toHaveBeenCalled();
  });
});
