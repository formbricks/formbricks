import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import { TSurvey, TSurveyLanguage, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { QuestionOptionChoice } from "./question-option-choice";

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: (props: any) => (
    <div data-testid="question-form-input" className={props.className}></div>
  ),
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ children }: any) => <div data-testid="tooltip-renderer">{children}</div>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe("QuestionOptionChoice", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render correctly for a standard choice", () => {
    const choice = { id: "choice1", label: { default: "Choice 1" } };
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [choice],
    } as any;

    render(
      <QuestionOptionChoice
        choice={choice}
        choiceIdx={0}
        questionIdx={0}
        updateChoice={vi.fn()}
        deleteChoice={vi.fn()}
        addChoice={vi.fn()}
        isInvalid={false}
        localSurvey={
          {
            languages: [{ code: "default", name: "Default", enabled: true, default: true }],
          } as unknown as TSurvey
        }
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        surveyLanguages={[
          { language: { code: "default" } as unknown as TLanguage, enabled: true, default: true },
        ]}
        question={question}
        updateQuestion={vi.fn()}
        surveyLanguageCodes={["default"]}
        locale="en-US"
      />
    );

    expect(screen.getByTestId("tooltip-renderer")).toBeDefined();
    expect(screen.getByTestId("question-form-input")).toBeDefined();
    const addButton = screen.getByTestId("button");
    expect(addButton).toBeDefined();
  });

  test("should call deleteChoice when the 'Delete choice' button is clicked for a standard choice", async () => {
    const choice = { id: "choice1", label: { default: "Choice 1" } };
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [
        choice,
        { id: "choice2", label: { default: "Choice 2" } },
        { id: "choice3", label: { default: "Choice 3" } },
      ],
    } as any;
    const deleteChoice = vi.fn();

    render(
      <QuestionOptionChoice
        choice={choice}
        choiceIdx={0}
        questionIdx={0}
        updateChoice={vi.fn()}
        deleteChoice={deleteChoice}
        addChoice={vi.fn()}
        isInvalid={false}
        localSurvey={
          {
            languages: [
              {
                language: { code: "default" } as unknown as TLanguage,
                enabled: true,
                default: true,
              } as unknown as TSurveyLanguage,
            ],
          } as unknown as TSurvey
        }
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        surveyLanguages={[
          { language: { code: "default" } as unknown as TLanguage, enabled: true, default: true },
        ]}
        question={question}
        updateQuestion={vi.fn()}
        surveyLanguageCodes={["default"]}
        locale="en-US"
      />
    );

    const deleteButtons = screen.getAllByTestId("button");
    const deleteButton = deleteButtons[0]; // The first button should be the delete button based on the rendered output
    await userEvent.click(deleteButton);

    expect(deleteChoice).toHaveBeenCalledWith(0);
  });

  test("should call addChoice when the 'Add choice below' button is clicked for a standard choice", async () => {
    const addChoice = vi.fn();
    const choice = { id: "choice1", label: { default: "Choice 1" } };
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [choice],
    } as any;

    render(
      <QuestionOptionChoice
        choice={choice}
        choiceIdx={0}
        questionIdx={0}
        updateChoice={vi.fn()}
        deleteChoice={vi.fn()}
        addChoice={addChoice}
        isInvalid={false}
        localSurvey={
          {
            languages: [{ code: "default", name: "Default", enabled: true, default: true }],
          } as unknown as TSurvey
        }
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        surveyLanguages={[
          { language: { code: "default" } as unknown as TLanguage, enabled: true, default: true },
        ]}
        question={question}
        updateQuestion={vi.fn()}
        surveyLanguageCodes={["default"]}
        locale="en-US"
      />
    );

    const addButton = screen.getByTestId("button");
    expect(addButton).toBeDefined();
    await userEvent.click(addButton);
    expect(addChoice).toHaveBeenCalledWith(0);
  });

  test("should render QuestionFormInput with correct props for a standard choice", () => {
    const choice = { id: "choice1", label: { default: "Choice 1" } };
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [choice],
    } as any;

    render(
      <QuestionOptionChoice
        choice={choice}
        choiceIdx={0}
        questionIdx={0}
        updateChoice={vi.fn()}
        deleteChoice={vi.fn()}
        addChoice={vi.fn()}
        isInvalid={false}
        localSurvey={
          {
            languages: [{ code: "default", name: "Default", enabled: true, default: true }],
          } as unknown as TSurvey
        }
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        surveyLanguages={[
          { language: { code: "default" } as unknown as TLanguage, enabled: true, default: true },
        ]}
        question={question}
        updateQuestion={vi.fn()}
        surveyLanguageCodes={["default"]}
        locale="en-US"
      />
    );

    expect(screen.getByTestId("question-form-input")).toBeDefined();
  });

  test("should handle malformed choice object gracefully when id is missing", () => {
    const choice = { label: { default: "Choice without ID" } } as any;
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [choice],
    } as any;

    render(
      <QuestionOptionChoice
        choice={choice}
        choiceIdx={0}
        questionIdx={0}
        updateChoice={vi.fn()}
        deleteChoice={vi.fn()}
        addChoice={vi.fn()}
        isInvalid={false}
        localSurvey={
          {
            languages: [{ code: "default", name: "Default", enabled: true, default: true }],
          } as unknown as TSurvey
        }
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        surveyLanguages={[
          { language: { code: "default" } as unknown as TLanguage, enabled: true, default: true },
        ]}
        question={question}
        updateQuestion={vi.fn()}
        surveyLanguageCodes={["default"]}
        locale="en-US"
      />
    );

    const questionFormInput = screen.getByTestId("question-form-input");
    expect(questionFormInput).toBeDefined();
    expect(questionFormInput).toBeInTheDocument();
  });

  test("should not throw an error when question.choices is undefined", () => {
    const choice = { id: "choice1", label: { default: "Choice 1" } };
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: undefined,
    } as any;

    const renderComponent = () =>
      render(
        <QuestionOptionChoice
          choice={choice}
          choiceIdx={0}
          questionIdx={0}
          updateChoice={vi.fn()}
          deleteChoice={vi.fn()}
          addChoice={vi.fn()}
          isInvalid={false}
          localSurvey={
            {
              languages: [{ code: "default", name: "Default", enabled: true, default: true }],
            } as unknown as TSurvey
          }
          selectedLanguageCode="default"
          setSelectedLanguageCode={vi.fn()}
          surveyLanguages={[
            { language: { code: "default" } as unknown as TLanguage, enabled: true, default: true },
          ]}
          question={question}
          updateQuestion={vi.fn()}
          surveyLanguageCodes={["default"]}
          locale="en-US"
        />
      );

    expect(renderComponent).not.toThrow();
  });

  test("should render correctly for the 'other' choice with drag functionality disabled", () => {
    const choice = { id: "other", label: { default: "Other" } };
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [choice],
    } as any;

    render(
      <QuestionOptionChoice
        choice={choice}
        choiceIdx={0}
        questionIdx={0}
        updateChoice={vi.fn()}
        deleteChoice={vi.fn()}
        addChoice={vi.fn()}
        isInvalid={false}
        localSurvey={
          {
            languages: [{ code: "default", name: "Default", enabled: true, default: true }],
          } as unknown as TSurvey
        }
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        surveyLanguages={[
          { language: { code: "default" } as unknown as TLanguage, enabled: true, default: true },
        ]}
        question={question}
        updateQuestion={vi.fn()}
        surveyLanguageCodes={["default"]}
        locale="en-US"
      />
    );

    const dragHandle = screen.getByRole("button", {
      name: "",
      hidden: true,
    });
    expect(dragHandle).toHaveClass("invisible");
  });

  test("should handle missing language code gracefully", () => {
    const choice = { id: "choice1", label: { en: "Choice 1" } };
    const question = {
      id: "question1",
      headline: { default: "Question 1" },
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [choice],
    } as any;

    render(
      <QuestionOptionChoice
        choice={choice}
        choiceIdx={0}
        questionIdx={0}
        updateChoice={vi.fn()}
        deleteChoice={vi.fn()}
        addChoice={vi.fn()}
        isInvalid={false}
        localSurvey={{ languages: [] } as any}
        selectedLanguageCode="fr"
        setSelectedLanguageCode={vi.fn()}
        surveyLanguages={[]}
        question={question}
        updateQuestion={vi.fn()}
        surveyLanguageCodes={[]}
        locale="en-US"
      />
    );

    expect(screen.getByTestId("question-form-input")).toBeDefined();
  });
});
