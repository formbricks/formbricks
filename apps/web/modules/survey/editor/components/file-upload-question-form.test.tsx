import { createI18nString } from "@/lib/i18n/utils";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyFileUploadQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { FileUploadQuestionForm } from "./file-upload-question-form";

// Mock dependencies
vi.mock("@/modules/utils/hooks/useGetBillingInfo", () => ({
  useGetBillingInfo: () => ({
    billingInfo: { plan: "free" },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock QuestionFormInput component to verify it receives correct props
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({
    id,
    value,
    label,
    localSurvey,
    questionIdx,
    updateQuestion,
    selectedLanguageCode,
    setSelectedLanguageCode,
    isInvalid,
    locale,
  }: any) => (
    <div data-testid="question-form-input">
      <label htmlFor={id}>{label}</label>
      <input
        data-testid={`input-${id}`}
        id={id}
        value={value?.default ?? ""}
        aria-invalid={isInvalid ? "true" : "false"}
      />
    </div>
  ),
}));

// Mock UI components
vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: ({ children, isChecked, title, description, htmlId, onToggle }: any) => (
    <div
      data-testid={htmlId ? `advanced-option-${htmlId}` : "advanced-option-toggle"}
      data-checked={isChecked}>
      <div data-testid="toggle-title">{title}</div>
      <div data-testid="toggle-description">{description}</div>
      {htmlId && (
        <button data-testid={`toggle-${htmlId}`} onClick={() => onToggle?.(!isChecked)}>
          {title}
        </button>
      )}
      {isChecked && (htmlId ? <div data-testid={`toggle-content-${htmlId}`}>{children}</div> : children)}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, size, variant, type }: any) => (
    <button data-testid="button" data-size={size} data-variant={variant} data-type={type} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ id, value, onChange, placeholder, className, type }: any) => (
    <input
      data-testid={id ?? "input"}
      id={id}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      type={type}
    />
  ),
}));

describe("FileUploadQuestionForm", () => {
  const mockUpdateQuestion = vi.fn();
  const mockSetSelectedLanguageCode = vi.fn();

  // Create mock data
  const mockQuestion: TSurveyFileUploadQuestion = {
    id: "question_1",
    type: TSurveyQuestionTypeEnum.FileUpload,
    headline: createI18nString("Upload your file", ["en", "fr"]),
    required: true,
    allowMultipleFiles: false,
    allowedFileExtensions: ["pdf", "jpg"],
  };

  const mockSurvey = {
    id: "survey_123",
    environmentId: "env_123",
    questions: [mockQuestion],
    languages: [
      {
        id: "lan_123",
        default: true,
        enabled: true,
        language: {
          id: "en",
          code: "en",
          name: "English",
          createdAt: new Date(),
          updatedAt: new Date(),
          alias: null,
          projectId: "project_123",
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the headline input field with the correct label and value", () => {
    render(
      <FileUploadQuestionForm
        localSurvey={mockSurvey as any}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        isFormbricksCloud={false}
        locale="en-US"
        project={{} as any}
      />
    );

    // Check if QuestionFormInput is rendered with correct props
    const questionFormInput = screen.getByTestId("question-form-input");
    expect(questionFormInput).toBeInTheDocument();

    // Check if the label is rendered correctly
    const label = screen.getByText("environments.surveys.edit.question*");
    expect(label).toBeInTheDocument();

    // Check if the input field is rendered with the correct value
    const input = screen.getByTestId("input-headline");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Upload your file");
  });

  test("handles file extensions with uppercase characters and leading dots", async () => {
    const user = userEvent.setup();

    render(
      <FileUploadQuestionForm
        localSurvey={mockSurvey as any}
        question={mockQuestion} // Starts with ["pdf", "jpg"]
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        isFormbricksCloud={false}
        locale="en-US"
        project={{} as any}
      />
    );

    // Find the input field for adding extensions
    const extensionInput = screen.getByTestId("input");

    // Test with uppercase extension "PDF" -> should be added as "pdf"
    await user.type(extensionInput, "PDF");

    // Find and click the "Allow file type" button
    const buttons = screen.getAllByTestId("button");
    const addButton = buttons.find(
      (button) => button.textContent === "environments.surveys.edit.allow_file_type"
    );
    expect(addButton).toBeTruthy();
    await user.click(addButton!);

    // Verify updateQuestion was NOT called because "pdf" (lowercase of "PDF") already exists
    expect(mockUpdateQuestion).not.toHaveBeenCalled();
    // Verify toast error for duplicate
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.edit.this_extension_is_already_added");

    // Clear mocks for next step
    vi.mocked(mockUpdateQuestion).mockClear();
    vi.mocked(toast.error).mockClear();

    // Test with a leading dot and uppercase ".PNG" -> should be added as "png"
    await user.clear(extensionInput);
    await user.type(extensionInput, ".PNG");
    await user.click(addButton!);

    // Verify updateQuestion was called with the new extension added (dot removed, lowercase)
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      allowedFileExtensions: ["pdf", "jpg", "png"], // Should add "png"
    });
    // Verify no error toast was shown
    expect(toast.error).not.toHaveBeenCalled();

    // Clear mocks for next step
    vi.mocked(mockUpdateQuestion).mockClear();
    vi.mocked(toast.error).mockClear();

    // Test adding an existing extension (lowercase) "jpg"
    await user.clear(extensionInput);
    await user.type(extensionInput, "jpg");
    await user.click(addButton!);

    // Verify updateQuestion was NOT called again because "jpg" already exists
    expect(mockUpdateQuestion).not.toHaveBeenCalled();

    // Verify that the error toast WAS shown for the duplicate
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.edit.this_extension_is_already_added");
  });

  test("shows an error toast when trying to add an empty extension", async () => {
    const user = userEvent.setup();

    render(
      <FileUploadQuestionForm
        localSurvey={mockSurvey as any}
        question={mockQuestion} // Starts with ["pdf", "jpg"]
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        isFormbricksCloud={false}
        locale="en-US"
        project={{} as any}
      />
    );

    // Find the input field for adding extensions
    const extensionInput = screen.getByTestId("input");
    expect(extensionInput).toHaveValue(""); // Ensure it's initially empty

    // Find and click the "Allow file type" button
    const buttons = screen.getAllByTestId("button");
    const addButton = buttons.find(
      (button) => button.textContent === "environments.surveys.edit.allow_file_type"
    );
    expect(addButton).toBeTruthy();
    await user.click(addButton!);

    // Verify updateQuestion was NOT called
    expect(mockUpdateQuestion).not.toHaveBeenCalled();

    // Verify that the error toast WAS shown for the empty input
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.edit.please_enter_a_file_extension");
  });

  test("shows an error toast when trying to add an unsupported file extension", async () => {
    const user = userEvent.setup();

    render(
      <FileUploadQuestionForm
        localSurvey={mockSurvey as any}
        question={mockQuestion} // Starts with ["pdf", "jpg"]
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        isFormbricksCloud={false}
        locale="en-US"
        project={{} as any}
      />
    );

    // Find the input field for adding extensions
    const extensionInput = screen.getByTestId("input");

    // Type an unsupported extension
    await user.type(extensionInput, "exe");

    // Find and click the "Allow file type" button
    const buttons = screen.getAllByTestId("button");
    const addButton = buttons.find(
      (button) => button.textContent === "environments.surveys.edit.allow_file_type"
    );
    expect(addButton).toBeTruthy();
    await user.click(addButton!);

    // Verify updateQuestion was NOT called
    expect(mockUpdateQuestion).not.toHaveBeenCalled();

    // Verify that the error toast WAS shown for the unsupported type
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.edit.this_file_type_is_not_supported");
  });
});
