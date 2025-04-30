import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslate } from "@tolgee/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyRatingQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { RatingQuestionForm } from "./rating-question-form";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @formkit/auto-animate
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({
    value,
    id,
    selectedLanguageCode,
  }: {
    value: any;
    id: string;
    selectedLanguageCode?: string;
  }) => {
    if (id === "buttonLabel") {
      return <input data-testid="buttonLabel-input" value={value?.default || value} readOnly />;
    }
    const displayValue = selectedLanguageCode
      ? value?.[selectedLanguageCode] || value?.default || value
      : value?.default || value;
    return <input data-testid={`headline-input-${id}`} value={displayValue} readOnly />;
  },
}));

vi.mock("@/modules/survey/editor/components/rating-type-dropdown", () => ({
  Dropdown: ({ options, defaultValue, onSelect }: any) => {
    // Determine if this is a scale dropdown or range dropdown based on options
    const isScaleDropdown = options.some(
      (option: any) => typeof option.value === "string" && ["number", "star", "smiley"].includes(option.value)
    );

    const testId = isScaleDropdown ? "scale-type-dropdown" : "range-dropdown";

    return (
      <div data-testid={testId} data-defaultvalue={defaultValue}>
        {isScaleDropdown ? "Scale Dropdown" : "Range Dropdown"}
        <select
          value={defaultValue}
          onChange={(e) => {
            const value = isScaleDropdown ? e.target.value : parseInt(e.target.value);
            const selectedOption = options.find((option: any) => option.value === value);
            onSelect(selectedOption);
          }}>
          {options.map((option: any) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
}));

describe("RatingQuestionForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render the headline input field with the provided question headline value", () => {
    const mockQuestion: TSurveyRatingQuestion = {
      id: "1",
      type: "rating",
      headline: {
        default: "Test Headline",
      },
      scale: "number",
      range: 5,
      required: false,
    };

    const mockSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      languages: [{ language: { code: "default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env-id",
      updatedAt: "2024-01-01T00:00:00.000Z",
      welcomeCard: {
        id: "welcome-card-id",
        type: "welcomeCard",
        headline: { default: "Welcome" },
        buttonAlignment: "right",
      },
      endings: [],
    };

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
      flag: "us",
      momentJSLocale: "en-US",
    };

    render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    const headlineInput = screen.getByTestId("headline-input-headline");
    expect(headlineInput).toBeDefined();
    expect(headlineInput).toHaveAttribute("value", "Test Headline");
  });

  test("should render the scale dropdown with the correct default value and options", () => {
    const mockQuestion: TSurveyRatingQuestion = {
      id: "1",
      type: "rating",
      headline: {
        default: "Test Headline",
      },
      scale: "smiley",
      range: 5,
      required: false,
    };

    const mockSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      languages: [{ language: { code: "default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env-id",
      updatedAt: "2024-01-01T00:00:00.000Z",
      welcomeCard: {
        id: "welcome-card-id",
        type: "welcomeCard",
        headline: { default: "Welcome" },
        buttonAlignment: "right",
      },
      endings: [],
    };

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
      flag: "us",
      momentJSLocale: "en-US",
    };

    render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    expect(screen.getByText("environments.surveys.edit.scale")).toBeDefined();
    const scaleTypeDropdown = screen.getByTestId("scale-type-dropdown");
    expect(scaleTypeDropdown).toBeDefined();
    expect(scaleTypeDropdown).toHaveAttribute("data-defaultvalue", "smiley");
  });

  test("should render the range dropdown with the correct default value and options", () => {
    const mockQuestion: TSurveyRatingQuestion = {
      id: "1",
      type: "rating",
      headline: {
        default: "Test Headline",
      },
      scale: "number",
      range: 3,
      required: false,
    };

    const mockSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      languages: [{ language: { code: "default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env-id",
      updatedAt: "2024-01-01T00:00:00.000Z",
      welcomeCard: {
        id: "welcome-card-id",
        type: "welcomeCard",
        headline: { default: "Welcome" },
        buttonAlignment: "right",
      },
      endings: [],
    };

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
      flag: "us",
      momentJSLocale: "en-US",
    };

    render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    const dropdown = screen.getByTestId("range-dropdown");
    expect(dropdown).toBeDefined();
    expect(dropdown).toHaveAttribute("data-defaultvalue", "3");
  });

  test("should call updateQuestion with scale: 'star' and isColorCodingEnabled: false when star scale is selected", async () => {
    const mockQuestion: TSurveyRatingQuestion = {
      id: "1",
      type: "rating",
      headline: {
        default: "Test Headline",
      },
      scale: "number",
      range: 5,
      required: false,
      isColorCodingEnabled: true, // Initial value
    };

    const mockSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      languages: [{ language: { code: "default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env-id",
      updatedAt: "2024-01-01T00:00:00.000Z",
      welcomeCard: {
        id: "welcome-card-id",
        type: "welcomeCard",
        headline: { default: "Welcome" },
        buttonAlignment: "right",
      },
      endings: [],
    };

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
      flag: "us",
      momentJSLocale: "en-US",
    };

    render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    const scaleTypeDropdown = screen.getByTestId("scale-type-dropdown");
    expect(scaleTypeDropdown).toBeDefined();

    // Simulate selecting the 'star' option
    await userEvent.selectOptions(scaleTypeDropdown.querySelector("select")!, ["star"]);

    expect(updateQuestion).toHaveBeenCalledWith(0, { scale: "star", isColorCodingEnabled: false });
  });

  test("should render buttonLabel input when question.required changes from true to false", () => {
    const mockQuestion: TSurveyRatingQuestion = {
      id: "1",
      type: "rating",
      headline: {
        default: "Test Headline",
      },
      scale: "number",
      range: 5,
      required: true,
    };

    const mockSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      languages: [{ language: { code: "default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env-id",
      updatedAt: "2024-01-01T00:00:00.000Z",
      welcomeCard: {
        id: "welcome-card-id",
        type: "welcomeCard",
        headline: { default: "Welcome" },
        buttonAlignment: "right",
      },
      endings: [],
    };

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
      flag: "us",
      momentJSLocale: "en-US",
    };

    // Initial render with required: true
    render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    // Assert that buttonLabel input is NOT present
    let buttonLabelInput = screen.queryByTestId("buttonLabel-input");
    expect(buttonLabelInput).toBeNull();

    // Update question to required: false
    mockQuestion.required = false;

    // Re-render with required: false
    render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    // Assert that buttonLabel input is now present
    buttonLabelInput = screen.getByTestId("buttonLabel-input");
    expect(buttonLabelInput).toBeDefined();
  });

  test("should preserve and display content for each language code when selectedLanguageCode prop changes", () => {
    const mockQuestion: TSurveyRatingQuestion = {
      id: "1",
      type: "rating",
      headline: {
        default: "Test Headline Default",
        fr: "Test Headline French",
      },
      scale: "number",
      range: 5,
      required: false,
    };

    const mockSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      languages: [
        { language: { code: "default" }, default: true },
        { language: { code: "fr" }, default: false },
      ],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env-id",
      updatedAt: "2024-01-01T00:00:00.000Z",
      welcomeCard: {
        id: "welcome-card-id",
        type: "welcomeCard",
        headline: { default: "Welcome" },
        buttonAlignment: "right",
      },
      endings: [],
    };

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
      flag: "us",
      momentJSLocale: "en-US",
    };

    const { rerender } = render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    // Check default language content
    const headlineInput = screen.getByTestId("headline-input-headline");
    expect(headlineInput).toBeDefined();
    expect(headlineInput).toHaveAttribute("value", "Test Headline Default");

    // Re-render with French language code
    rerender(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="fr"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    // Check French language content
    expect(screen.getByTestId("headline-input-headline")).toHaveAttribute("value", "Test Headline French");
  });

  test("should handle and display extremely long lowerLabel and upperLabel values", () => {
    const longLabel =
      "This is an extremely long label to test how the component handles text overflow. ".repeat(10);
    const mockQuestion: TSurveyRatingQuestion = {
      id: "1",
      type: "rating",
      headline: { default: "Test Headline" },
      scale: "number",
      range: 5,
      required: false,
      lowerLabel: { default: longLabel },
      upperLabel: { default: longLabel },
    };

    const mockSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      languages: [{ language: { code: "default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env-id",
      updatedAt: "2024-01-01T00:00:00.000Z",
      welcomeCard: {
        id: "welcome-card-id",
        type: "welcomeCard",
        headline: { default: "Welcome" },
        buttonAlignment: "right",
      },
      endings: [],
    };

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
      flag: "us",
      momentJSLocale: "en-US",
    };

    render(
      <RatingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    const lowerLabelInput = screen.getByTestId("headline-input-lowerLabel");
    expect(lowerLabelInput).toBeDefined();
    expect(lowerLabelInput).toHaveAttribute("value", longLabel);

    const upperLabelInput = screen.getByTestId("headline-input-upperLabel");
    expect(upperLabelInput).toBeDefined();
    expect(upperLabelInput).toHaveAttribute("value", longLabel);
  });
});
