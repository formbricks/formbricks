import { ActionClass } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CreateNewActionTab } from "./create-new-action-tab";

// Mock the NoCodeActionForm and CodeActionForm components
vi.mock("@/modules/ui/components/no-code-action-form", () => ({
  NoCodeActionForm: () => <div data-testid="no-code-action-form">NoCodeActionForm</div>,
}));

vi.mock("@/modules/ui/components/code-action-form", () => ({
  CodeActionForm: () => <div data-testid="code-action-form">CodeActionForm</div>,
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  FORMBRICKS_API_HOST: "http://localhost:3000",
  FORMBRICKS_ENVIRONMENT_ID: "test-env-id",
}));

// Mock the createActionClassAction function
vi.mock("../actions", () => ({
  createActionClassAction: vi.fn(),
}));

describe("CreateNewActionTab", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all expected fields and UI elements when provided with valid props", () => {
    const actionClasses: ActionClass[] = [];
    const setActionClasses = vi.fn();
    const setOpen = vi.fn();
    const isReadOnly = false;
    const setLocalSurvey = vi.fn();
    const environmentId = "test-env-id";

    render(
      <CreateNewActionTab
        actionClasses={actionClasses}
        setActionClasses={setActionClasses}
        setOpen={setOpen}
        isReadOnly={isReadOnly}
        setLocalSurvey={setLocalSurvey}
        environmentId={environmentId}
      />
    );

    // Check for the presence of key UI elements
    expect(screen.getByText("environments.actions.action_type")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "common.no_code" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "common.code" })).toBeInTheDocument();
    expect(screen.getByLabelText("environments.actions.what_did_your_user_do")).toBeInTheDocument();
    expect(screen.getByLabelText("common.description")).toBeInTheDocument();
    expect(screen.getByTestId("no-code-action-form")).toBeInTheDocument(); // Ensure NoCodeActionForm is rendered by default
  });
});
