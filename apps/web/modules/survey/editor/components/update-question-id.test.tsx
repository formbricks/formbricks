import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import * as validationModule from "@formbricks/types/surveys/validation";
import { UpdateQuestionId } from "./update-question-id";

vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ id, value, onChange, className, disabled }: any) => (
    <input
      data-testid={id}
      id={id}
      value={value || ""}
      onChange={onChange}
      className={className}
      disabled={disabled}
    />
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, disabled, size }: any) => (
    <button data-testid="save-button" onClick={onClick} disabled={disabled} data-size={size}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ htmlFor, children }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@formbricks/types/surveys/validation", () => ({
  validateId: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("UpdateQuestionId", () => {
  afterEach(() => {
    cleanup();
  });

  test("should update the question ID and call updateQuestion when a valid and unique ID is entered and the save button is clicked", async () => {
    const user = userEvent.setup();
    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      status: "draft",
      questions: [{ id: "question1" }, { id: "question2" }] as TSurveyQuestion[],
      languages: [],
      endings: [],
      delay: 0,
      hiddenFields: { fieldIds: [] },
    } as unknown as TSurvey;

    const mockQuestion = {
      id: "question1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
    } as unknown as TSurveyQuestion;
    const mockQuestionIdx = 0;
    const mockUpdateQuestion = vi.fn();

    render(
      <UpdateQuestionId
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={mockQuestionIdx}
        updateQuestion={mockUpdateQuestion}
      />
    );

    const inputElement = screen.getByTestId("questionId");
    const saveButton = screen.getByTestId("save-button");

    // Simulate user entering a new, valid ID
    await userEvent.clear(inputElement);
    await userEvent.type(inputElement, "newQuestionId");

    // Simulate clicking the save button
    await user.click(saveButton);

    // Assert that updateQuestion is called with the correct arguments
    expect(mockUpdateQuestion).toHaveBeenCalledTimes(1);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(mockQuestionIdx, { id: "newQuestionId" });
  });

  test("should disable the input field if the survey is not in draft mode and the question is not a draft", () => {
    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      status: "active", // Survey is not in draft mode
      questions: [{ id: "question1", isDraft: false }] as TSurveyQuestion[],
      languages: [],
      endings: [],
      delay: 0,
      hiddenFields: { fieldIds: [] },
    } as unknown as TSurvey;

    const mockQuestion = {
      id: "question1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      isDraft: false, // Question is not a draft
    } as unknown as TSurveyQuestion;
    const mockQuestionIdx = 0;
    const mockUpdateQuestion = vi.fn();

    render(
      <UpdateQuestionId
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={mockQuestionIdx}
        updateQuestion={mockUpdateQuestion}
      />
    );

    const inputElement = screen.getByTestId("questionId") as HTMLInputElement; // NOSONAR // cast to HTMLInputElement to access disabled property
    expect(inputElement.disabled).toBe(true);
  });

  test("should display an error message and not update the question ID if the entered ID contains special characters and is invalid", async () => {
    const user = userEvent.setup();
    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      status: "draft",
      questions: [{ id: "question1" }, { id: "question2" }] as TSurveyQuestion[],
      languages: [],
      endings: [],
      delay: 0,
      hiddenFields: { fieldIds: [] },
    } as unknown as TSurvey;

    const mockQuestion = {
      id: "question1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
    } as unknown as TSurveyQuestion;
    const mockQuestionIdx = 0;
    const mockUpdateQuestion = vi.fn();
    const { validateId } = validationModule;
    vi.mocked(validateId).mockReturnValue("Invalid ID");

    render(
      <UpdateQuestionId
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={mockQuestionIdx}
        updateQuestion={mockUpdateQuestion}
      />
    );

    const inputElement = screen.getByTestId("questionId") as HTMLInputElement; // NOSONAR // cast to HTMLInputElement to access disabled property
    const saveButton = screen.getByTestId("save-button");

    // Simulate user entering a new, invalid ID with special characters
    await userEvent.clear(inputElement);
    await userEvent.type(inputElement, "@#$%^&*");

    // Simulate clicking the save button
    await user.click(saveButton);

    // Assert that validateId is called with the correct arguments
    expect(vi.mocked(validateId)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(validateId)).toHaveBeenCalledWith(
      "Question",
      "@#$%^&*",
      mockLocalSurvey.questions.map((q) => q.id),
      mockLocalSurvey.endings.map((e) => e.id),
      mockLocalSurvey.hiddenFields.fieldIds ?? []
    );

    // Assert that updateQuestion is not called
    expect(mockUpdateQuestion).not.toHaveBeenCalled();

    // Assert that toast.error is called
    expect(toast.error).toHaveBeenCalledWith("Invalid ID");
  });

  test("should handle case sensitivity when validating question IDs", async () => {
    const user = userEvent.setup();
    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      status: "draft",
      questions: [{ id: "question1" }, { id: "question2" }] as TSurveyQuestion[],
      languages: [],
      endings: [],
      delay: 0,
      hiddenFields: { fieldIds: [] },
    } as unknown as TSurvey;

    const mockQuestion = {
      id: "question1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
    } as unknown as TSurveyQuestion;
    const mockQuestionIdx = 0;
    const mockUpdateQuestion = vi.fn();

    // Mock validateId to return an error if the ID is 'Question1' (case-insensitive duplicate)
    const { validateId } = validationModule;
    vi.mocked(validateId).mockImplementation(
      (_type, field, _existingQuestionIds, _existingEndingCardIds, _existingHiddenFieldIds) => {
        if (field.toLowerCase() === "question1") {
          return "ID already exists";
        }
        return null; // Return null instead of undefined
      }
    );

    render(
      <UpdateQuestionId
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={mockQuestionIdx}
        updateQuestion={mockUpdateQuestion}
      />
    );

    const inputElement = screen.getByTestId("questionId") as HTMLInputElement; // NOSONAR // cast to HTMLInputElement to access disabled property
    const saveButton = screen.getByTestId("save-button");

    // Simulate user entering 'Question1'
    await userEvent.clear(inputElement);
    await userEvent.type(inputElement, "Question1");

    // Simulate clicking the save button
    await user.click(saveButton);

    // Assert that updateQuestion is NOT called because the ID is considered a duplicate
    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });

  test("should display an error message and not update the question ID if the entered ID is a reserved identifier", async () => {
    const user = userEvent.setup();
    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      status: "draft",
      questions: [{ id: "question1" }, { id: "question2" }] as TSurveyQuestion[],
      languages: [],
      endings: [],
      delay: 0,
      hiddenFields: { fieldIds: [] },
    } as unknown as TSurvey;

    const mockQuestion = {
      id: "question1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
    } as unknown as TSurveyQuestion;
    const mockQuestionIdx = 0;
    const mockUpdateQuestion = vi.fn();

    const { validateId } = validationModule;
    vi.mocked(validateId).mockReturnValue("This ID is reserved.");

    render(
      <UpdateQuestionId
        localSurvey={mockLocalSurvey}
        question={mockQuestion}
        questionIdx={mockQuestionIdx}
        updateQuestion={mockUpdateQuestion}
      />
    );

    const inputElement = screen.getByTestId("questionId") as HTMLInputElement; // NOSONAR // cast to HTMLInputElement to access disabled property
    const saveButton = screen.getByTestId("save-button");

    // Simulate user entering a reserved identifier
    await userEvent.clear(inputElement);
    await userEvent.type(inputElement, "reservedId");

    // Simulate clicking the save button
    await user.click(saveButton);

    // Assert that updateQuestion is not called
    expect(mockUpdateQuestion).not.toHaveBeenCalled();

    // Assert that an error message is displayed
    expect(toast.error).toHaveBeenCalledWith("This ID is reserved.");
  });
});
