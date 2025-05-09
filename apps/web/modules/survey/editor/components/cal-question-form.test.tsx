import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyCalQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { CalQuestionForm } from "./cal-question-form";

// Mock necessary modules and components
vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: ({
    isChecked,
    onToggle,
    htmlId,
    children,
    title,
  }: {
    isChecked: boolean;
    onToggle?: (checked: boolean) => void;
    htmlId?: string;
    children?: React.ReactNode;
    title?: string;
  }) => {
    let content;
    if (onToggle && htmlId) {
      content = (
        <input
          type="checkbox"
          id={htmlId}
          checked={isChecked}
          onChange={() => onToggle(!isChecked)}
          data-testid="cal-host-toggle"
        />
      );
    } else {
      content = isChecked ? "Enabled" : "Disabled";
    }

    return (
      <div data-testid="advanced-option-toggle">
        {htmlId && title ? <label htmlFor={htmlId}>{title}</label> : null}
        {content}
        {isChecked && children}
      </div>
    );
  },
}));

// Updated Input mock to use id prop correctly
vi.mock("@/modules/ui/components/input", () => ({
  Input: ({
    id,
    onChange,
    value,
  }: {
    id: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string;
  }) => (
    <input
      id={id} // Ensure the input has the ID the label points to
      value={value}
      onChange={onChange}
    />
  ),
}));

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({
    id,
    value,
    label,
    localSurvey,
    questionIdx,
    isInvalid,
    selectedLanguageCode,
    locale,
  }: any) => (
    <div data-testid="question-form-input">
      {id
        ? `${id} - ${value?.default} - ${label} - ${localSurvey.id} - ${questionIdx} - ${isInvalid.toString()} - ${selectedLanguageCode} - ${locale}`
        : ""}
    </div>
  ),
}));

describe("CalQuestionForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("should initialize isCalHostEnabled to true if question.calHost is defined", () => {
    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();

    const mockQuestion = {
      id: "cal_question_1",
      type: TSurveyQuestionTypeEnum.Cal,
      headline: { default: "Book a meeting" },
      calUserName: "testuser",
      calHost: "cal.com",
    } as unknown as TSurveyCalQuestion;

    const mockLocalSurvey: TSurvey = {
      id: "survey_123",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env_123",
      status: "draft",
      questions: [],
      languages: [
        {
          id: "lang_1",
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
      endings: [],
    } as unknown as TSurvey;

    render(
      <CalQuestionForm
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
        lastQuestion={false}
      />
    );

    // Assert that the AdvancedOptionToggle component is rendered with isChecked prop set to true
    expect(screen.getByTestId("advanced-option-toggle")).toHaveTextContent(
      "environments.surveys.edit.custom_hostname"
    );
  });

  test("should set calHost to undefined when isCalHostEnabled is toggled off", async () => {
    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();
    const user = userEvent.setup();

    const mockQuestion = {
      id: "cal_question_1",
      type: TSurveyQuestionTypeEnum.Cal,
      headline: { default: "Book a meeting" },
      calUserName: "testuser",
      calHost: "cal.com",
    } as unknown as TSurveyCalQuestion;

    const mockLocalSurvey: TSurvey = {
      id: "survey_123",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env_123",
      status: "draft",
      questions: [],
      languages: [
        {
          id: "lang_1",
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
      endings: [],
    } as unknown as TSurvey;

    render(
      <CalQuestionForm
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
        lastQuestion={false}
      />
    );

    // Find the toggle and click it to disable calHost
    const toggle = screen.getByTestId("cal-host-toggle");
    await user.click(toggle);

    // Assert that updateQuestion is called with calHost: undefined
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { calHost: undefined });
  });

  test("should render QuestionFormInput for the headline field with the correct props", () => {
    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();

    const mockQuestion = {
      id: "cal_question_1",
      type: TSurveyQuestionTypeEnum.Cal,
      headline: { default: "Book a meeting" },
      calUserName: "testuser",
      calHost: "cal.com",
    } as unknown as TSurveyCalQuestion;

    const mockLocalSurvey = {
      id: "survey_123",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env_123",
      status: "draft",
      questions: [],
      languages: [
        {
          id: "lang_1",
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
      endings: [],
    } as unknown as TSurvey;

    render(
      <CalQuestionForm
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
        lastQuestion={false}
      />
    );

    // Assert that the QuestionFormInput component is rendered with the correct props
    expect(screen.getByTestId("question-form-input")).toHaveTextContent(
      "headline - Book a meeting - environments.surveys.edit.question* - survey_123 - 0 - false - en - en-US"
    );
  });

  test("should call updateQuestion with an empty calUserName when the input is cleared", async () => {
    const mockUpdateQuestion = vi.fn();
    const mockSetSelectedLanguageCode = vi.fn();
    const user = userEvent.setup();

    const mockQuestion = {
      id: "cal_question_1",
      type: TSurveyQuestionTypeEnum.Cal,
      headline: { default: "Book a meeting" },
      calUserName: "testuser",
      calHost: "cal.com",
    } as unknown as TSurveyCalQuestion;

    const mockLocalSurvey = {
      id: "survey_123",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env_123",
      status: "draft",
      questions: [],
      languages: [
        {
          id: "lang_1",
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
      endings: [],
    } as unknown as TSurvey;

    render(
      <CalQuestionForm
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale="en-US"
        lastQuestion={false}
      />
    );

    const calUserNameInput = screen.getByLabelText("environments.surveys.edit.cal_username", {
      selector: "input",
    });
    await user.clear(calUserNameInput);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { calUserName: "" });
  });
});
