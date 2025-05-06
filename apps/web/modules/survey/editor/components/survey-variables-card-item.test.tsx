import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyVariable } from "@formbricks/types/surveys/types";
import { SurveyVariablesCardItem } from "./survey-variables-card-item";

describe("SurveyVariablesCardItem", () => {
  afterEach(() => {
    cleanup();
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
});
