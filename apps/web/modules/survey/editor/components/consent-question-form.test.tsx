import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyConsentQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ConsentQuestionForm } from "./consent-question-form";

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({ label, id }: { label: string; id: string }) => (
    <div data-testid="question-form-input" data-field-id={id}>
      {label}
    </div>
  ),
}));

describe("ConsentQuestionForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the form with headline, description, and checkbox label when provided valid props", () => {
    const mockQuestion = {
      id: "consent1",
      type: TSurveyQuestionTypeEnum.Consent,
      headline: { en: "Consent Headline" },
      html: { en: "Consent Description" },
      label: { en: "Consent Checkbox Label" },
    } as unknown as TSurveyConsentQuestion;

    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      status: "draft",
      questions: [],
      languages: [],
    } as unknown as TSurvey;

    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();
    const mockLocale: TUserLocale = "en-US";

    render(
      <ConsentQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockLocalSurvey}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={mockLocale}
        isStorageConfigured={true}
      />
    );

    const questionFormInputs = screen.getAllByTestId("question-form-input");
    expect(questionFormInputs).toHaveLength(3);

    // Check headline field
    expect(questionFormInputs[0]).toHaveTextContent("environments.surveys.edit.question*");
    expect(questionFormInputs[0]).toHaveAttribute("data-field-id", "headline");

    // Check html (description) field
    expect(questionFormInputs[1]).toHaveTextContent("common.description");
    expect(questionFormInputs[1]).toHaveAttribute("data-field-id", "subheader");

    // Check label (checkbox label) field
    expect(questionFormInputs[2]).toHaveTextContent("environments.surveys.edit.checkbox_label*");
    expect(questionFormInputs[2]).toHaveAttribute("data-field-id", "label");
  });
});
