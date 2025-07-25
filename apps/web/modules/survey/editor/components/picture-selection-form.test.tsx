import { createI18nString } from "@/lib/i18n/utils";
import { PictureSelectionForm } from "@/modules/survey/editor/components/picture-selection-form";
import { FileInput } from "@/modules/ui/components/file-input";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [vi.fn()],
}));
vi.mock("@/modules/survey/components/question-form-input", () => ({
  // Mock as a simple component returning a div with a test ID
  QuestionFormInput: ({ id }: { id: string }) => <div data-testid={`question-form-input-${id}`}></div>,
}));
vi.mock("@/modules/ui/components/file-input", () => ({
  FileInput: vi.fn(),
}));

const mockUpdateQuestion = vi.fn();
const mockSetSelectedLanguageCode = vi.fn();

const baseQuestion: TSurveyPictureSelectionQuestion = {
  id: "picture1",
  type: TSurveyQuestionTypeEnum.PictureSelection,
  headline: createI18nString("Picture Headline", ["default"]),
  subheader: createI18nString("Picture Subheader", ["default"]),
  required: true,
  allowMulti: false,
  choices: [
    { id: "choice1", imageUrl: "url1" },
    { id: "choice2", imageUrl: "url2" },
  ],
};

const baseSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  environmentId: "env1",
  status: "draft",
  questions: [baseQuestion],
  languages: [{ language: { code: "default" } as unknown as TLanguage, default: true, enabled: true }],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  autoComplete: null,
  surveyClosedMessage: null,
  singleUse: null,
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  styling: null,
  hiddenFields: { enabled: true },
  variables: [],
  pin: null,
  displayPercentage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as TSurvey;

const defaultProps = {
  localSurvey: baseSurvey,
  question: baseQuestion,
  questionIdx: 0,
  updateQuestion: mockUpdateQuestion,
  lastQuestion: false,
  selectedLanguageCode: "default",
  setSelectedLanguageCode: mockSetSelectedLanguageCode,
  isInvalid: false,
  locale: "en-US" as TUserLocale,
};

describe("PictureSelectionForm", () => {
  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders headline and subheader inputs", () => {
    render(<PictureSelectionForm {...defaultProps} />);
    // Check if two instances of the mocked component are rendered
    const headlineInput = screen.getByTestId("question-form-input-headline");
    const subheaderInput = screen.getByTestId("question-form-input-subheader");
    expect(headlineInput).toBeInTheDocument();
    expect(subheaderInput).toBeInTheDocument();
  });

  test("renders 'Add Description' button when subheader is undefined", () => {
    const questionWithoutSubheader = { ...baseQuestion, subheader: undefined };
    render(<PictureSelectionForm {...defaultProps} question={questionWithoutSubheader} />);
    const addButton = screen.getByText("environments.surveys.edit.add_description");
    expect(addButton).toBeInTheDocument();
  });

  test("calls updateQuestion to add subheader when 'Add Description' is clicked", async () => {
    const user = userEvent.setup();
    const questionWithoutSubheader = { ...baseQuestion, subheader: undefined };
    render(<PictureSelectionForm {...defaultProps} question={questionWithoutSubheader} />);
    const addButton = screen.getByText("environments.surveys.edit.add_description");
    await user.click(addButton);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      subheader: createI18nString("", ["default"]),
    });
  });

  test("calls updateQuestion when files are uploaded via FileInput", () => {
    render(<PictureSelectionForm {...defaultProps} />);
    const fileInputProps = vi.mocked(FileInput).mock.calls[0][0];
    fileInputProps.onFileUpload(["url1", "url2", "url3"], "image"); // Simulate adding a new file
    expect(mockUpdateQuestion).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        choices: expect.arrayContaining([
          expect.objectContaining({ imageUrl: "url1" }),
          expect.objectContaining({ imageUrl: "url2" }),
          expect.objectContaining({ imageUrl: "url3", id: expect.any(String) }),
        ]),
      })
    );
  });

  test("calls updateQuestion when files are removed via FileInput", () => {
    render(<PictureSelectionForm {...defaultProps} />);
    const fileInputProps = vi.mocked(FileInput).mock.calls[0][0];
    fileInputProps.onFileUpload(["url1"], "image"); // Simulate removing url2
    expect(mockUpdateQuestion).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        choices: [expect.objectContaining({ imageUrl: "url1" })],
      })
    );
  });

  test("renders multi-select toggle and calls updateQuestion on click", async () => {
    const user = userEvent.setup();
    render(<PictureSelectionForm {...defaultProps} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked(); // Initial state based on baseQuestion
    await user.click(toggle);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { allowMulti: true });
  });

  test("shows validation message when isInvalid is true and choices < 2", () => {
    const invalidQuestion = { ...baseQuestion, choices: [{ id: "choice1", imageUrl: "url1" }] };
    render(<PictureSelectionForm {...defaultProps} question={invalidQuestion} isInvalid={true} />);
    const validationSpan = screen.getByText("(environments.surveys.edit.upload_at_least_2_images)");
    expect(validationSpan).toHaveClass("text-red-600");
  });

  test("does not show validation message in red when isInvalid is false", () => {
    const invalidQuestion = { ...baseQuestion, choices: [{ id: "choice1", imageUrl: "url1" }] };
    render(<PictureSelectionForm {...defaultProps} question={invalidQuestion} isInvalid={false} />);
    const validationSpan = screen.getByText("(environments.surveys.edit.upload_at_least_2_images)");
    expect(validationSpan).not.toHaveClass("text-red-600");
    expect(validationSpan).toHaveClass("text-slate-400");
  });
});
