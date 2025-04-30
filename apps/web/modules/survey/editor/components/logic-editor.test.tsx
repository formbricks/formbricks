import { LogicEditorActions } from "@/modules/survey/editor/components/logic-editor-actions";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { cleanup, render, screen } from "@testing-library/react";
import { useTranslate } from "@tolgee/react";
import { ReactElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyLogic,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { LogicEditor } from "./logic-editor";

// Mock the subcomponents to isolate the LogicEditor component
vi.mock("@/modules/survey/editor/components/logic-editor-conditions", () => ({
  LogicEditorConditions: vi.fn(() => <div data-testid="logic-editor-conditions"></div>),
}));

vi.mock("@/modules/survey/editor/components/logic-editor-actions", () => ({
  LogicEditorActions: vi.fn(() => <div data-testid="logic-editor-actions"></div>),
}));

// Mock useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

// Mock getQuestionIconMap function
vi.mock("@/modules/survey/lib/questions", () => ({
  getQuestionIconMap: vi.fn(() => ({
    [TSurveyQuestionTypeEnum.OpenText]: <div data-testid="open-text-icon"></div>,
  })),
}));

describe("LogicEditor", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders LogicEditorConditions and LogicEditorActions with correct props", () => {
    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env1",
      type: "app",
      responsive: true,
      welcomeCard: {
        enabled: false,
        headline: { default: "" },
        buttonLabel: { default: "" },
        showResponseCount: false,
        timeToFinish: false,
      },
      thankYouCard: { enabled: false, title: { default: "" }, buttonLabel: { default: "" }, buttonLink: "" },
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Question 1" },
          subheader: { default: "" },
          required: false,
          inputType: "text",
          placeholder: { default: "" },
          longAnswer: false,
          logic: [],
          charLimit: { enabled: false },
        },
      ],
      endings: [],
      hiddenFields: { enabled: false, fieldIds: [] },
      variables: [],
    };
    const mockLogicItem: TSurveyLogic = {
      id: "logic1",
      conditions: { id: "cond1", connector: "and", conditions: [] },
      actions: [],
    };
    const mockUpdateQuestion = vi.fn();
    const mockQuestion: TSurveyQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      subheader: { default: "" },
      required: false,
      inputType: "text",
      placeholder: { default: "" },
      longAnswer: false,
      logic: [],
      charLimit: { enabled: false },
    };
    const questionIdx = 0;
    const logicIdx = 0;

    render(
      <LogicEditor
        localSurvey={mockLocalSurvey}
        logicItem={mockLogicItem}
        updateQuestion={mockUpdateQuestion}
        question={mockQuestion}
        questionIdx={questionIdx}
        logicIdx={logicIdx}
        isLast={false}
      />
    );

    // Assert that LogicEditorConditions is rendered with the correct props
    expect(screen.getByTestId("logic-editor-conditions")).toBeInTheDocument();
    expect(vi.mocked(LogicEditorConditions).mock.calls[0][0]).toEqual({
      conditions: mockLogicItem.conditions,
      updateQuestion: mockUpdateQuestion,
      question: mockQuestion,
      questionIdx: questionIdx,
      localSurvey: mockLocalSurvey,
      logicIdx: logicIdx,
    });

    // Assert that LogicEditorActions is rendered with the correct props
    expect(screen.getByTestId("logic-editor-actions")).toBeInTheDocument();
    expect(vi.mocked(LogicEditorActions).mock.calls[0][0]).toEqual({
      logicItem: mockLogicItem,
      logicIdx: logicIdx,
      question: mockQuestion,
      updateQuestion: mockUpdateQuestion,
      localSurvey: mockLocalSurvey,
      questionIdx: questionIdx,
    });
  });
});
