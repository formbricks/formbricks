import { createI18nString } from "@/lib/i18n/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyCTAQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { CTAQuestionForm } from "./cta-question-form";

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: () => <div data-testid="question-form-input">QuestionFormInput</div>,
}));

vi.mock("@/modules/ee/multi-language-surveys/components/localized-editor", () => ({
  LocalizedEditor: () => <div data-testid="localized-editor">LocalizedEditor</div>,
}));

vi.mock("@/modules/ui/components/options-switch", () => ({
  OptionsSwitch: () => <div data-testid="options-switch">OptionsSwitch</div>,
}));

describe("CTAQuestionForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all required fields and components when provided with valid props", () => {
    const mockQuestion: TSurveyCTAQuestion = {
      id: "test-question",
      type: TSurveyQuestionTypeEnum.CTA,
      headline: createI18nString("Test Headline", ["en"]),
      buttonLabel: createI18nString("Next", ["en"]),
      backButtonLabel: createI18nString("Back", ["en"]),
      buttonExternal: false,
      buttonUrl: "",
      required: true,
    };

    const mockLocalSurvey = {
      id: "test-survey",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "test-env",
      status: "draft",
      questions: [],
      languages: [],
    } as unknown as TSurvey;

    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();
    const mockLocale = "en-US";

    render(
      <CTAQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        lastQuestion={false}
        isInvalid={false}
        localSurvey={mockLocalSurvey}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={mockLocale}
      />
    );

    const questionFormInputs = screen.getAllByTestId("question-form-input");
    expect(questionFormInputs.length).toBe(2);
    expect(screen.getByTestId("localized-editor")).toBeInTheDocument();
    expect(screen.getByTestId("options-switch")).toBeInTheDocument();
  });
});
