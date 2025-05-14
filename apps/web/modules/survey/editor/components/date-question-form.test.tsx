import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyDateQuestion,
  TSurveyLanguage,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { DateQuestionForm } from "./date-question-form";

// Mock dependencies
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({ id, value, label, locale, selectedLanguageCode }: any) => (
    <div
      data-testid={`question-form-input-${id}`}
      data-value={value?.default}
      data-label={label}
      data-locale={locale}
      data-language={selectedLanguageCode}>
      {label}: {value?.[selectedLanguageCode] ?? value?.default}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, className, size, variant, type }: any) => (
    <button
      data-testid="add-description-button"
      onClick={onClick}
      className={className}
      data-size={size}
      data-variant={variant}
      type={type}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children, htmlFor }: any) => (
    <label data-testid={`label-${htmlFor}`} htmlFor={htmlFor}>
      {children}
    </label>
  ),
}));

vi.mock("@/modules/ui/components/options-switch", () => ({
  OptionsSwitch: ({ options, currentOption, handleOptionChange }: any) => (
    <div data-testid="options-switch" data-current-option={currentOption}>
      {options.map((option: any) => (
        <button
          key={option.value}
          data-testid={`option-${option.value}`}
          onClick={() => handleOptionChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  PlusIcon: () => <div data-testid="plus-icon">PlusIcon</div>,
}));

// Mock with implementation to track calls and arguments
const extractLanguageCodesMock = vi.fn().mockReturnValue(["default", "en", "fr"]);
const createI18nStringMock = vi.fn().mockImplementation((text, _) => ({
  default: text,
  en: "",
  fr: "",
}));

vi.mock("@/lib/i18n/utils", () => ({
  extractLanguageCodes: (languages: any) => extractLanguageCodesMock(languages),
  createI18nString: (text: string, languages: string[]) => createI18nStringMock(text, languages),
}));

describe("DateQuestionForm", () => {
  afterEach(() => {
    cleanup();
  });

  const mockQuestion: TSurveyDateQuestion = {
    id: "q1",
    type: TSurveyQuestionTypeEnum.Date,
    headline: {
      default: "Select a date",
      en: "Select a date",
      fr: "Sélectionnez une date",
    },
    required: true,
    format: "M-d-y",
    // Note: subheader is intentionally undefined for this test
  };

  const mockLocalSurvey = {
    id: "survey1",
    environmentId: "env1",
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    questions: [mockQuestion],
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome" },
      html: { default: "" },
    } as unknown as TSurvey["welcomeCard"],
    hiddenFields: {
      enabled: false,
    },
    languages: [
      {
        default: true,
        language: {
          code: "en",
        } as unknown as TLanguage,
      } as TSurveyLanguage,
      {
        default: false,
        language: {
          code: "fr",
        } as unknown as TLanguage,
      } as TSurveyLanguage,
    ],
    endings: [],
  } as unknown as TSurvey;

  const mockUpdateQuestion = vi.fn();
  const mockSetSelectedLanguageCode = vi.fn();

  test("should render the headline input field with the correct label and value", () => {
    render(
      <DateQuestionForm
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
      />
    );

    // Check if the headline input field is rendered with the correct label and value
    const headlineInput = screen.getByTestId("question-form-input-headline");
    expect(headlineInput).toBeInTheDocument();
    expect(headlineInput).toHaveAttribute("data-label", "environments.surveys.edit.question*");
    expect(headlineInput).toHaveAttribute("data-value", "Select a date");
  });

  test("should display the 'Add Description' button when the question object has an undefined subheader property", async () => {
    // Reset mocks to ensure clean state
    mockUpdateQuestion.mockReset();

    // Set up mocks for this specific test
    extractLanguageCodesMock.mockReturnValueOnce(["default", "en", "fr"]);
    createI18nStringMock.mockReturnValueOnce({
      default: "",
      en: "",
      fr: "",
    });

    const user = userEvent.setup();

    render(
      <DateQuestionForm
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
      />
    );

    // Check if the 'Add Description' button is rendered
    const addDescriptionButton = screen.getByTestId("add-description-button");
    expect(addDescriptionButton).toBeInTheDocument();
    expect(addDescriptionButton).toHaveTextContent("environments.surveys.edit.add_description");

    // Check if the button has the correct properties
    expect(addDescriptionButton).toHaveAttribute("data-size", "sm");
    expect(addDescriptionButton).toHaveAttribute("data-variant", "secondary");
    expect(addDescriptionButton).toHaveAttribute("type", "button");

    // Check if the PlusIcon is rendered inside the button
    const plusIcon = screen.getByTestId("plus-icon");
    expect(plusIcon).toBeInTheDocument();

    // Click the button and verify that updateQuestion is called with the correct parameters
    await user.click(addDescriptionButton);

    // Verify the mock was called correctly
    expect(mockUpdateQuestion).toHaveBeenCalledTimes(1);
    // Use a more flexible assertion that doesn't rely on exact structure matching
    expect(mockUpdateQuestion).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        subheader: expect.anything(),
      })
    );
  });

  test("should handle empty language configuration when adding a subheader", async () => {
    // Create a survey with empty languages array
    const mockLocalSurveyWithEmptyLanguages = {
      id: "survey1",
      environmentId: "env1",
      name: "Test Survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "draft",
      questions: [mockQuestion],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome" },
        html: { default: "" },
      } as unknown as TSurvey["welcomeCard"],
      hiddenFields: {
        enabled: false,
      },
      languages: [], // Empty languages array
      endings: [],
    } as unknown as TSurvey;

    // Set up the mock to return an empty array when extractLanguageCodes is called with empty languages
    extractLanguageCodesMock.mockReturnValueOnce([]);

    // Set up createI18nString mock to return an empty i18n object
    createI18nStringMock.mockReturnValueOnce({ default: "" });

    render(
      <DateQuestionForm
        localSurvey={mockLocalSurveyWithEmptyLanguages}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
      />
    );

    // Verify the "Add Description" button is rendered since subheader is undefined
    const addDescriptionButton = screen.getByTestId("add-description-button");
    expect(addDescriptionButton).toBeInTheDocument();
    expect(addDescriptionButton).toHaveTextContent("environments.surveys.edit.add_description");

    // Click the "Add Description" button
    const user = userEvent.setup();
    await user.click(addDescriptionButton);

    // Verify extractLanguageCodes was called with the empty languages array
    expect(extractLanguageCodesMock).toHaveBeenCalledWith([]);

    // Verify createI18nString was called with empty string and empty array
    expect(createI18nStringMock).toHaveBeenCalledWith("", []);

    // Verify updateQuestion was called with the correct parameters
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      subheader: { default: "" },
    });
  });

  test("should handle malformed language configuration when adding a subheader", async () => {
    // Create a survey with malformed languages array (missing required properties)
    const mockLocalSurveyWithMalformedLanguages: TSurvey = {
      id: "survey1",
      environmentId: "env1",
      name: "Test Survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "draft",
      questions: [mockQuestion],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome" },
        html: { default: "" },
      } as unknown as TSurvey["welcomeCard"],
      hiddenFields: {
        enabled: false,
      },
      // @ts-ignore - Intentionally malformed for testing
      languages: [{ default: true }], // Missing language object
      endings: [],
    };

    // Set up the mock to return a fallback array when extractLanguageCodes is called with malformed languages
    extractLanguageCodesMock.mockReturnValueOnce(["default"]);

    // Set up createI18nString mock to return an i18n object with default language
    createI18nStringMock.mockReturnValueOnce({ default: "" });

    render(
      <DateQuestionForm
        localSurvey={mockLocalSurveyWithMalformedLanguages}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
      />
    );

    // Verify the "Add Description" button is rendered
    const addDescriptionButton = screen.getByTestId("add-description-button");
    expect(addDescriptionButton).toBeInTheDocument();

    // Click the "Add Description" button
    const user = userEvent.setup();
    await user.click(addDescriptionButton);

    // Verify extractLanguageCodes was called with the malformed languages array
    expect(extractLanguageCodesMock).toHaveBeenCalledWith([{ default: true }]);

    // Verify createI18nString was called with empty string and the extracted language codes
    expect(createI18nStringMock).toHaveBeenCalledWith("", ["default"]);

    // Verify updateQuestion was called with the correct parameters
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      subheader: { default: "" },
    });
  });

  test("should handle null language configuration when adding a subheader", async () => {
    // Create a survey with null languages property
    const mockLocalSurveyWithNullLanguages: TSurvey = {
      id: "survey1",
      environmentId: "env1",
      name: "Test Survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "draft",
      questions: [mockQuestion],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome" },
        html: { default: "" },
      } as unknown as TSurvey["welcomeCard"],
      hiddenFields: {
        enabled: false,
      },
      // @ts-ignore - Intentionally set to null for testing
      languages: null,
      endings: [],
    };

    // Set up the mock to return an empty array when extractLanguageCodes is called with null
    extractLanguageCodesMock.mockReturnValueOnce([]);

    // Set up createI18nString mock to return an empty i18n object
    createI18nStringMock.mockReturnValueOnce({ default: "" });

    render(
      <DateQuestionForm
        localSurvey={mockLocalSurveyWithNullLanguages}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
      />
    );

    // Verify the "Add Description" button is rendered
    const addDescriptionButton = screen.getByTestId("add-description-button");
    expect(addDescriptionButton).toBeInTheDocument();

    // Click the "Add Description" button
    const user = userEvent.setup();
    await user.click(addDescriptionButton);

    // Verify extractLanguageCodes was called with null
    expect(extractLanguageCodesMock).toHaveBeenCalledWith(null);

    // Verify createI18nString was called with empty string and empty array
    expect(createI18nStringMock).toHaveBeenCalledWith("", []);

    // Verify updateQuestion was called with the correct parameters
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      subheader: { default: "" },
    });
  });
});
