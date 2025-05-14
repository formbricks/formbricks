import * as utils from "@/modules/survey/editor/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyVariable } from "@formbricks/types/surveys/types";
import { SurveyVariablesCardItem } from "./survey-variables-card-item";

vi.mock("@/modules/survey/editor/lib/utils", () => {
  return {
    findVariableUsedInLogic: vi.fn(),
    getVariableTypeFromValue: vi.fn().mockImplementation((value) => {
      if (typeof value === "number") return "number";
      if (typeof value === "boolean") return "boolean";
      return "text";
    }),
    translateOptions: vi.fn().mockReturnValue([]),
    validateLogic: vi.fn(),
  };
});

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("SurveyVariablesCardItem", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const methods = useForm<TSurveyVariable>({
      defaultValues: {
        id: "newVarId",
        name: "",
        type: "number",
        value: 0,
      },
      mode: "onChange",
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  test("should create a new survey variable when mode is 'create' and the form is submitted", async () => {
    const mockSetLocalSurvey = vi.fn();
    const initialSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env123",
      type: "app",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: ["field1", "field2"],
      },
      variables: [],
    } as unknown as TSurvey;

    render(
      <TestWrapper>
        <SurveyVariablesCardItem
          mode="create"
          localSurvey={initialSurvey}
          setLocalSurvey={mockSetLocalSurvey}
        />
      </TestWrapper>
    );

    const nameInput = screen.getByPlaceholderText("environments.surveys.edit.field_name_eg_score_price");
    const valueInput = screen.getByPlaceholderText("environments.surveys.edit.initial_value");
    const addButton = screen.getByRole("button", { name: "environments.surveys.edit.add_variable" });

    await userEvent.type(nameInput, "new_variable");
    await userEvent.type(valueInput, "10");
    await userEvent.click(addButton);

    expect(mockSetLocalSurvey).toHaveBeenCalledTimes(1);
    expect(mockSetLocalSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.arrayContaining([
          expect.objectContaining({
            name: "new_variable",
            value: 10,
          }),
        ]),
      })
    );
  });

  test("should not create a new survey variable when mode is 'create' and the form input is invalid", async () => {
    const mockSetLocalSurvey = vi.fn();
    const initialSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env123",
      type: "app",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: ["field1", "field2"],
      },
      variables: [],
    } as unknown as TSurvey;

    render(
      <TestWrapper>
        <SurveyVariablesCardItem
          mode="create"
          localSurvey={initialSurvey}
          setLocalSurvey={mockSetLocalSurvey}
        />
      </TestWrapper>
    );

    const nameInput = screen.getByPlaceholderText("environments.surveys.edit.field_name_eg_score_price");
    const valueInput = screen.getByPlaceholderText("environments.surveys.edit.initial_value");
    const addButton = screen.getByRole("button", { name: "environments.surveys.edit.add_variable" });

    await userEvent.type(nameInput, "1invalidvariablename");
    await userEvent.type(valueInput, "10");
    await userEvent.click(addButton);

    const errorMessage = screen.getByText("environments.surveys.edit.variable_name_must_start_with_a_letter");
    expect(errorMessage).toBeVisible();
    expect(mockSetLocalSurvey).not.toHaveBeenCalled();
  });

  test("should display an error message when the variable name is invalid", async () => {
    const mockSetLocalSurvey = vi.fn();
    const initialSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env123",
      type: "app",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: ["field1", "field2"],
      },
      variables: [],
    } as unknown as TSurvey;

    render(
      <TestWrapper>
        <SurveyVariablesCardItem
          mode="create"
          localSurvey={initialSurvey}
          setLocalSurvey={mockSetLocalSurvey}
        />
      </TestWrapper>
    );

    const nameInput = screen.getByPlaceholderText("environments.surveys.edit.field_name_eg_score_price");
    await userEvent.type(nameInput, "1invalid_name");

    const errorMessage = screen.getByText("environments.surveys.edit.variable_name_must_start_with_a_letter");
    expect(errorMessage).toBeVisible();
  });

  test("should handle undefined variable prop in edit mode without crashing", () => {
    const mockSetLocalSurvey = vi.fn();
    const initialSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env123",
      type: "app",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: ["field1", "field2"],
      },
      variables: [],
    } as unknown as TSurvey;

    const { container } = render(
      <SurveyVariablesCardItem
        mode="edit"
        localSurvey={initialSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        variable={undefined}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test("should display an error message when creating a variable with an existing name", async () => {
    const mockSetLocalSurvey = vi.fn();
    const existingVariableName = "existing_variable";
    const initialSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env123",
      type: "app",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: ["field1", "field2"],
      },
      variables: [
        {
          id: "existingVarId",
          name: existingVariableName,
          type: "number",
          value: 0,
        },
      ],
    } as unknown as TSurvey;

    render(
      <TestWrapper>
        <SurveyVariablesCardItem
          mode="create"
          localSurvey={initialSurvey}
          setLocalSurvey={mockSetLocalSurvey}
        />
      </TestWrapper>
    );

    const nameInput = screen.getByPlaceholderText("environments.surveys.edit.field_name_eg_score_price");
    const addButton = screen.getByRole("button", { name: "environments.surveys.edit.add_variable" });

    await userEvent.type(nameInput, existingVariableName);
    await userEvent.click(addButton);

    expect(
      screen.getByText("environments.surveys.edit.variable_name_is_already_taken_please_choose_another")
    ).toBeVisible();
  });

  test("should show error toast if trying to delete a variable used in logic and not call setLocalSurvey", async () => {
    const variableUsedInLogic = {
      id: "logicVarId",
      name: "logic_variable",
      type: "text",
      value: "test_value",
    } as TSurveyVariable;

    const mockSetLocalSurvey = vi.fn();

    // Mock findVariableUsedInLogic to return 2, indicating the variable is used in logic
    const findVariableUsedInLogicMock = vi.fn().mockReturnValue(2);
    vi.spyOn(utils, "findVariableUsedInLogic").mockImplementation(findVariableUsedInLogicMock);

    const initialSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env123",
      type: "app",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      questions: [
        {
          id: "q1WithLogic",
          type: "openText",
          headline: { default: "Question with logic" },
          required: false,
          logic: [{ condition: "equals", value: "logicVarId", destination: "q2" }],
        },
        { id: "q2", type: "openText", headline: { default: "Q2" }, required: false },
      ],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: ["field1", "field2"],
      },
      variables: [variableUsedInLogic],
    } as unknown as TSurvey;

    render(
      <SurveyVariablesCardItem
        mode="edit"
        localSurvey={initialSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        variable={variableUsedInLogic}
      />
    );

    const deleteButton = screen.getByRole("button");
    await userEvent.click(deleteButton);

    expect(utils.findVariableUsedInLogic).toHaveBeenCalledWith(initialSurvey, variableUsedInLogic.id);
    expect(mockSetLocalSurvey).not.toHaveBeenCalled();
  });

  test("should delete variable when it's not used in logic", async () => {
    const variableToDelete = {
      id: "recallVarId",
      name: "recall_variable",
      type: "text",
      value: "recall_value",
    } as TSurveyVariable;

    const mockSetLocalSurvey = vi.fn();

    const findVariableUsedInLogicMock = vi.fn().mockReturnValue(-1);
    vi.spyOn(utils, "findVariableUsedInLogic").mockImplementation(findVariableUsedInLogicMock);

    const initialSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "env123",
      type: "app",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      questions: [
        {
          id: "q1",
          type: "openText",
          headline: { default: "Question with recall:recallVarId in it" },
          required: false,
        },
      ],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: ["field1", "field2"],
      },
      variables: [variableToDelete],
    } as unknown as TSurvey;

    render(
      <SurveyVariablesCardItem
        mode="edit"
        localSurvey={initialSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        variable={variableToDelete}
      />
    );

    const deleteButton = screen.getByRole("button");
    await userEvent.click(deleteButton);

    expect(utils.findVariableUsedInLogic).toHaveBeenCalledWith(initialSurvey, variableToDelete.id);
    expect(mockSetLocalSurvey).toHaveBeenCalledTimes(1);
    expect(mockSetLocalSurvey).toHaveBeenCalledWith(expect.any(Function));
  });
});
