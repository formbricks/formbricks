import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyConsentQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ConsentQuestionForm } from "./consent-question-form";

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({ label }: { label: string }) => <div data-testid="question-form-input">{label}</div>,
}));

vi.mock("@/modules/ee/multi-language-surveys/components/localized-editor", () => ({
  LocalizedEditor: ({ id }: { id: string }) => <div data-testid="localized-editor">{id}</div>,
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children }: { children: string }) => <div data-testid="label">{children}</div>,
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
      />
    );

    const questionFormInputs = screen.getAllByTestId("question-form-input");
    expect(questionFormInputs[0]).toHaveTextContent("environments.surveys.edit.question*");
    expect(screen.getByTestId("label")).toHaveTextContent("common.description");
    expect(screen.getByTestId("localized-editor")).toHaveTextContent("subheader");
    expect(questionFormInputs[1]).toHaveTextContent("environments.surveys.edit.checkbox_label*");
  });
});
