import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyRankingQuestion, TUserLocale } from "@formbricks/types/surveys/types";
import { RankingQuestionForm } from "./ranking-question-form";

// Place all mocks at the top of the file
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({ value }: { value: any }) => (
    <input
      data-testid="headline-input"
      value={value?.en || value?.de || value?.default || ""}
      onChange={() => {}}
    />
  ),
}));

vi.mock("@/modules/survey/editor/components/question-option-choice", () => ({
  QuestionOptionChoice: () => <div data-testid="question-option-choice" />,
}));

describe("RankingQuestionForm", () => {
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
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("should render the headline input field with the provided question headline", () => {
    const mockQuestion: TSurveyRankingQuestion = {
      id: "1",
      type: "ranking",
      headline: { default: "Test Headline" },
      choices: [],
      required: false,
    };

    const mockLocalSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      type: "link",
      languages: [{ language: { code: "default", name: "Default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env123",
    };

    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
    };

    render(
      <RankingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockLocalSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    const headlineInput = screen.getByTestId("headline-input");
    expect(headlineInput).toHaveValue("Test Headline");
  });

  test("should add a new choice when the 'Add Option' button is clicked", async () => {
    const mockQuestion: TSurveyRankingQuestion = {
      id: "1",
      type: "ranking",
      headline: { default: "Test Headline" },
      choices: [],
      required: false,
    };

    const mockLocalSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      type: "link",
      languages: [{ language: { code: "default", name: "Default" }, default: true }],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env123",
    };

    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
    };

    render(
      <RankingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockLocalSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    const addButton = screen.getByText("environments.surveys.edit.add_option");
    await userEvent.click(addButton);

    expect(mockUpdateQuestion).toHaveBeenCalledTimes(1);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          label: expect.any(Object),
        }),
      ]),
    });
  });

  test("should initialize new choices with empty strings for all configured survey languages", async () => {
    const mockQuestion: TSurveyRankingQuestion = {
      id: "1",
      type: "ranking",
      headline: { default: "Test Headline" },
      choices: [],
      required: false,
    };

    const mockLocalSurvey: TSurvey = {
      id: "123",
      name: "Test Survey",
      type: "link",
      languages: [
        { language: { code: "en", name: "English" }, default: true },
        { language: { code: "de", name: "German" }, default: false },
      ],
      questions: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      environmentId: "env123",
    };

    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = {
      code: "en",
      name: "English",
    };

    render(
      <RankingQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockLocalSurvey}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    // Simulate adding a new choice
    const addOptionButton = screen.getByText("environments.surveys.edit.add_option");
    await userEvent.click(addOptionButton);

    // Assert that updateQuestion is called with the new choice and that the new choice has empty strings for all languages
    expect(mockUpdateQuestion).toHaveBeenCalledTimes(1);
    const updatedQuestion = mockUpdateQuestion.mock.calls[0][1];
    expect(updatedQuestion.choices).toHaveLength(1);
    expect(updatedQuestion.choices[0].label).toEqual({ default: "", de: "" });
  });
});
