import { SurveyVariablesCard } from "@/modules/survey/editor/components/survey-variables-card";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyVariable } from "@formbricks/types/surveys/types";

// Mock the child component
vi.mock("@/modules/survey/editor/components/survey-variables-card-item", () => ({
  SurveyVariablesCardItem: ({ mode, variable }: { mode: string; variable?: TSurveyVariable }) => (
    <div data-testid={`survey-variables-card-item-${mode}`}>
      {mode === "edit" && variable ? `Edit: ${variable.name}` : "Create New Variable"}
    </div>
  ),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [vi.fn()]),
}));

const mockSetLocalSurvey = vi.fn();
const mockSetActiveQuestionId = vi.fn();

const mockSurvey = {
  id: "survey-123",
  name: "Test Survey",
  type: "app",
  status: "draft",
  questions: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  pin: null,
  displayPercentage: null,
  welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
  endings: [],
  hiddenFields: { enabled: false },
  variables: [
    { id: "var1", name: "variable_one", type: "number", value: 1 },
    { id: "var2", name: "variable_two", type: "text", value: "test" },
  ],
  languages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env-123",
  createdBy: null,
  segment: null,
  closeOnDate: null,
  runOnDate: null,
  isVerifyEmailEnabled: false,
  isSingleResponsePerEmailEnabled: false,
  recaptcha: null,
} as unknown as TSurvey;

const mockSurveyNoVariables: TSurvey = {
  ...mockSurvey,
  variables: [],
};

describe("SurveyVariablesCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with existing variables", () => {
    render(
      <SurveyVariablesCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        activeQuestionId={null}
        setActiveQuestionId={mockSetActiveQuestionId}
      />
    );

    expect(screen.getByText("common.variables")).toBeInTheDocument();
    // Check if edit items are not rendered (collapsible is closed initially)
    expect(screen.queryByText("Edit: variable_one")).toBeNull();
    expect(screen.queryByText("Edit: variable_two")).toBeNull();
    // Check if create item is not rendered (collapsible is closed initially)
    expect(screen.queryByText("Create New Variable")).toBeNull();
  });

  test("opens and closes the collapsible content on click", async () => {
    render(
      <SurveyVariablesCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        activeQuestionId={null}
        setActiveQuestionId={mockSetActiveQuestionId}
      />
    );

    const trigger = screen.getByText("common.variables");

    // Initially closed
    expect(screen.queryByText("Edit: variable_one")).toBeNull();
    expect(screen.queryByText("Create New Variable")).toBeNull();

    // Open
    await userEvent.click(trigger);
    expect(mockSetActiveQuestionId).toHaveBeenCalledWith(expect.stringContaining("fb-variables-"));
    // Need to re-render with the new activeQuestionId prop to simulate open state
    const activeId = mockSetActiveQuestionId.mock.calls[0][0];
    cleanup();
    render(
      <SurveyVariablesCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        activeQuestionId={activeId}
        setActiveQuestionId={mockSetActiveQuestionId}
      />
    );
    expect(screen.getByText("Edit: variable_one")).toBeVisible();
    expect(screen.getByText("Edit: variable_two")).toBeVisible();
    expect(screen.getByText("Create New Variable")).toBeVisible();

    // Close
    await userEvent.click(screen.getByText("common.variables")); // Use the same trigger element
    expect(mockSetActiveQuestionId).toHaveBeenCalledWith(null);
    // Need to re-render with null activeQuestionId to simulate closed state
    cleanup();
    render(
      <SurveyVariablesCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        activeQuestionId={null}
        setActiveQuestionId={mockSetActiveQuestionId}
      />
    );
    expect(screen.queryByText("Edit: variable_one")).toBeNull();
    expect(screen.queryByText("Create New Variable")).toBeNull();
  });

  test("renders placeholder text when no variables exist", async () => {
    render(
      <SurveyVariablesCard
        localSurvey={mockSurveyNoVariables}
        setLocalSurvey={mockSetLocalSurvey}
        activeQuestionId={null}
        setActiveQuestionId={mockSetActiveQuestionId}
      />
    );

    const trigger = screen.getByText("common.variables");
    await userEvent.click(trigger);

    // Re-render with active ID
    const activeId = mockSetActiveQuestionId.mock.calls[0][0];
    cleanup();
    render(
      <SurveyVariablesCard
        localSurvey={mockSurveyNoVariables}
        setLocalSurvey={mockSetLocalSurvey}
        activeQuestionId={activeId}
        setActiveQuestionId={mockSetActiveQuestionId}
      />
    );

    expect(screen.getByText("environments.surveys.edit.no_variables_yet_add_first_one_below")).toBeVisible();
    expect(screen.getByText("Create New Variable")).toBeVisible(); // Create section should still be visible
    expect(screen.queryByTestId("survey-variables-card-item-edit")).not.toBeInTheDocument();
  });
});
