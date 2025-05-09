import { createI18nString } from "@/lib/i18n/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyContactInfoQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { ContactInfoQuestionForm } from "./contact-info-question-form";

// Mock QuestionFormInput component
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn(({ id, label, value, selectedLanguageCode }) => (
    <div data-testid="question-form-input">
      <label data-testid="question-form-input-label">{label}</label>
      <div data-testid={`question-form-input-${id}`}>
        {selectedLanguageCode ? value?.[selectedLanguageCode] || "" : value?.default || ""}
      </div>
    </div>
  )),
}));

// Mock QuestionToggleTable component
vi.mock("@/modules/ui/components/question-toggle-table", () => ({
  QuestionToggleTable: vi.fn(({ fields }) => (
    <div data-testid="question-toggle-table">
      {fields?.map((field) => (
        <div key={field.id} data-testid={`question-toggle-table-field-${field.id}`}>
          {field.label}
        </div>
      ))}
    </div>
  )),
}));

// Mock the Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick }) => (
    <button data-testid="add-description-button" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock @formkit/auto-animate - simplify implementation
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

describe("ContactInfoQuestionForm", () => {
  let mockSurvey: TSurvey;
  let mockQuestion: TSurveyContactInfoQuestion;
  let updateQuestionMock: any;

  beforeEach(() => {
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

    mockSurvey = {
      id: "survey-1",
      name: "Test Survey",
      questions: [],
      languages: [],
    } as unknown as TSurvey;

    mockQuestion = {
      id: "contact-info-1",
      type: TSurveyQuestionTypeEnum.ContactInfo,
      headline: createI18nString("Headline Text", ["en"]),
      required: true,
      firstName: { show: true, required: false, placeholder: createI18nString("", ["en"]) },
      lastName: { show: true, required: false, placeholder: createI18nString("", ["en"]) },
      email: { show: true, required: false, placeholder: createI18nString("", ["en"]) },
      phone: { show: true, required: false, placeholder: createI18nString("", ["en"]) },
      company: { show: true, required: false, placeholder: createI18nString("", ["en"]) },
    } as unknown as TSurveyContactInfoQuestion;

    updateQuestionMock = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  test("should update required to false when all fields are visible but optional", () => {
    render(
      <ContactInfoQuestionForm
        localSurvey={mockSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestionMock}
        isInvalid={false}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    expect(updateQuestionMock).toHaveBeenCalledWith(0, { required: false });
  });

  test("should update required to true when all fields are visible and at least one is required", () => {
    mockQuestion = {
      ...mockQuestion,
      firstName: { show: true, required: true, placeholder: createI18nString("", ["en"]) },
    } as unknown as TSurveyContactInfoQuestion;

    render(
      <ContactInfoQuestionForm
        localSurvey={mockSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestionMock}
        isInvalid={false}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    expect(updateQuestionMock).toHaveBeenCalledWith(0, { required: true });
  });

  test("should update required to false when all fields are hidden", () => {
    mockQuestion = {
      ...mockQuestion,
      firstName: { show: false, required: false, placeholder: createI18nString("", ["en"]) },
      lastName: { show: false, required: false, placeholder: createI18nString("", ["en"]) },
      email: { show: false, required: false, placeholder: createI18nString("", ["en"]) },
      phone: { show: false, required: false, placeholder: createI18nString("", ["en"]) },
      company: { show: false, required: false, placeholder: createI18nString("", ["en"]) },
    } as unknown as TSurveyContactInfoQuestion;

    render(
      <ContactInfoQuestionForm
        localSurvey={mockSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={updateQuestionMock}
        isInvalid={false}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    expect(updateQuestionMock).toHaveBeenCalledWith(0, { required: false });
  });

  test("should display the subheader input field when the subheader property is defined", () => {
    const mockQuestionWithSubheader: TSurveyContactInfoQuestion = {
      ...mockQuestion,
      subheader: createI18nString("Subheader Text", ["en"]), // Define subheader
    } as unknown as TSurveyContactInfoQuestion;

    render(
      <ContactInfoQuestionForm
        localSurvey={mockSurvey}
        question={mockQuestionWithSubheader}
        questionIdx={0}
        updateQuestion={vi.fn()}
        isInvalid={false}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    const subheaderInput = screen.getByTestId("question-form-input-subheader");
    expect(subheaderInput).toBeInTheDocument();
  });

  test("should display the 'Add Description' button when subheader is undefined", () => {
    const mockQuestionWithoutSubheader: TSurveyContactInfoQuestion = {
      ...mockQuestion,
      subheader: undefined,
    } as unknown as TSurveyContactInfoQuestion;

    render(
      <ContactInfoQuestionForm
        localSurvey={mockSurvey}
        question={mockQuestionWithoutSubheader}
        questionIdx={0}
        updateQuestion={updateQuestionMock}
        isInvalid={false}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    const addButton = screen.getByTestId("add-description-button");
    expect(addButton).toBeInTheDocument();
  });

  test("should handle gracefully when selectedLanguageCode is not in translations", () => {
    render(
      <ContactInfoQuestionForm
        localSurvey={mockSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={vi.fn()}
        isInvalid={false}
        selectedLanguageCode="fr"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    const headlineValue = screen.getByTestId("question-form-input-headline");
    expect(headlineValue).toBeInTheDocument();
    expect(headlineValue).toHaveTextContent(""); // Expect empty string since "fr" is not in headline translations
  });

  test("should handle a question object with a new or custom field", () => {
    const mockQuestionWithCustomField: TSurveyContactInfoQuestion = {
      ...mockQuestion,
      // Add a custom field with an unexpected structure
      customField: { value: "Custom Value" },
    } as unknown as TSurveyContactInfoQuestion;

    render(
      <ContactInfoQuestionForm
        localSurvey={mockSurvey}
        question={mockQuestionWithCustomField}
        questionIdx={0}
        updateQuestion={vi.fn()}
        isInvalid={false}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    // Assert that the component renders without errors
    const headlineValue = screen.getByTestId("question-form-input-headline");
    expect(headlineValue).toBeInTheDocument();

    // Assert that the QuestionToggleTable is rendered
    const toggleTable = screen.getByTestId("question-toggle-table");
    expect(toggleTable).toBeInTheDocument();
  });
});
