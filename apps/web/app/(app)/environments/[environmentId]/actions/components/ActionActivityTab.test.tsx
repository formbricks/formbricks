import { createActionClassAction } from "@/modules/survey/editor/actions";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { getActiveInactiveSurveysAction } from "../actions";
import { ActionActivityTab } from "./ActionActivityTab";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/actions/utils", () => ({
  ACTION_TYPE_ICON_LOOKUP: {
    noCode: <div>NoCodeIcon</div>,
    automatic: <div>AutomaticIcon</div>,
    code: <div>CodeIcon</div>,
  },
}));

vi.mock("@/lib/time", () => ({
  convertDateTimeStringShort: (dateString: string) => `formatted-${dateString}`,
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: (error: any) => `Formatted error: ${error?.message || "Unknown error"}`,
}));

vi.mock("@/lib/utils/strings", () => ({
  capitalizeFirstLetter: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
}));

vi.mock("@/modules/survey/editor/actions", () => ({
  createActionClassAction: vi.fn(),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/error-component", () => ({
  ErrorComponent: () => <div>ErrorComponent</div>,
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock("@/modules/ui/components/loading-spinner", () => ({
  LoadingSpinner: () => <div>LoadingSpinner</div>,
}));

vi.mock("../actions", () => ({
  getActiveInactiveSurveysAction: vi.fn(),
}));

const mockActionClass = {
  id: "action1",
  createdAt: new Date("2023-01-01T10:00:00Z"),
  updatedAt: new Date("2023-01-10T11:00:00Z"),
  name: "Test Action",
  description: "Test Description",
  type: "noCode",
  environmentId: "env1_dev",
  noCodeConfig: {
    /* ... */
  } as any,
} as unknown as TActionClass;

const mockEnvironmentDev = {
  id: "env1_dev",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
} as unknown as TEnvironment;

const mockEnvironmentProd = {
  id: "env1_prod",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
} as unknown as TEnvironment;

const mockOtherEnvActionClasses: TActionClass[] = [
  {
    id: "action2",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Existing Action Prod",
    type: "noCode",
    environmentId: "env1_prod",
  } as unknown as TActionClass,
  {
    id: "action3",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Existing Code Action Prod",
    type: "code",
    key: "existing-key",
    environmentId: "env1_prod",
  } as unknown as TActionClass,
];

describe("ActionActivityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveInactiveSurveysAction).mockResolvedValue({
      data: {
        activeSurveys: ["Active Survey 1"],
        inactiveSurveys: ["Inactive Survey 1", "Inactive Survey 2"],
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders loading state initially", () => {
    // Don't resolve the promise immediately
    vi.mocked(getActiveInactiveSurveysAction).mockReturnValue(new Promise(() => {}));
    render(
      <ActionActivityTab
        actionClass={mockActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={false}
      />
    );
    expect(screen.getByText("LoadingSpinner")).toBeInTheDocument();
  });

  test("renders error state if fetching surveys fails", async () => {
    vi.mocked(getActiveInactiveSurveysAction).mockResolvedValue({
      data: undefined,
    });
    render(
      <ActionActivityTab
        actionClass={mockActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={false}
      />
    );
    // Wait for the component to update after the promise resolves
    await screen.findByText("ErrorComponent");
    expect(screen.getByText("ErrorComponent")).toBeInTheDocument();
  });

  test("renders survey lists and action details correctly", async () => {
    render(
      <ActionActivityTab
        actionClass={mockActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={false}
      />
    );

    // Wait for loading to finish
    await screen.findByText("common.active_surveys");

    // Check survey lists
    expect(screen.getByText("Active Survey 1")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey 1")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey 2")).toBeInTheDocument();

    // Check action details
    // Use the actual Date.toString() output that the mock receives
    expect(screen.getByText(`formatted-${mockActionClass.createdAt.toString()}`)).toBeInTheDocument(); // Created on
    expect(screen.getByText(`formatted-${mockActionClass.updatedAt.toString()}`)).toBeInTheDocument(); // Last updated
    expect(screen.getByText("NoCodeIcon")).toBeInTheDocument(); // Type icon
    expect(screen.getByText("NoCode")).toBeInTheDocument(); // Type text
    expect(screen.getByText("Development")).toBeInTheDocument(); // Environment
    expect(screen.getByText("Copy to Production")).toBeInTheDocument(); // Copy button text
  });

  test("calls copyAction with correct data on button click", async () => {
    vi.mocked(createActionClassAction).mockResolvedValue({ data: { id: "newAction" } as any });
    render(
      <ActionActivityTab
        actionClass={mockActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={false}
      />
    );

    await screen.findByText("Copy to Production");
    const copyButton = screen.getByText("Copy to Production");
    await userEvent.click(copyButton);

    expect(createActionClassAction).toHaveBeenCalledTimes(1);
    // Include the extra properties that the component sends due to spreading mockActionClass
    const expectedActionInput = {
      ...mockActionClass, // Spread the original object
      name: "Test Action", // Keep the original name as it doesn't conflict
      environmentId: "env1_prod", // Target environment ID
    };
    // Remove properties not expected by the action call itself, even if sent by component
    delete (expectedActionInput as any).id;
    delete (expectedActionInput as any).createdAt;
    delete (expectedActionInput as any).updatedAt;

    // The assertion now checks against the structure sent by the component
    expect(createActionClassAction).toHaveBeenCalledWith({
      action: {
        ...mockActionClass, // Include id, createdAt, updatedAt etc.
        name: "Test Action",
        environmentId: "env1_prod",
      },
    });
    expect(toast.success).toHaveBeenCalledWith("environments.actions.action_copied_successfully");
  });

  test("handles name conflict during copy", async () => {
    vi.mocked(createActionClassAction).mockResolvedValue({ data: { id: "newAction" } as any });
    const conflictingActionClass = { ...mockActionClass, name: "Existing Action Prod" };
    render(
      <ActionActivityTab
        actionClass={conflictingActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={false}
      />
    );

    await screen.findByText("Copy to Production");
    const copyButton = screen.getByText("Copy to Production");
    await userEvent.click(copyButton);

    expect(createActionClassAction).toHaveBeenCalledTimes(1);

    // The assertion now checks against the structure sent by the component
    expect(createActionClassAction).toHaveBeenCalledWith({
      action: {
        ...conflictingActionClass, // Include id, createdAt, updatedAt etc.
        name: "Existing Action Prod (copy)",
        environmentId: "env1_prod",
      },
    });
    expect(toast.success).toHaveBeenCalledWith("environments.actions.action_copied_successfully");
  });

  test("handles key conflict during copy for 'code' type", async () => {
    const codeActionClass: TActionClass = {
      ...mockActionClass,
      id: "codeAction1",
      type: "code",
      key: "existing-key", // Conflicting key
      noCodeConfig: {
        /* ... */
      } as any,
    };
    render(
      <ActionActivityTab
        actionClass={codeActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={false}
      />
    );

    await screen.findByText("Copy to Production");
    const copyButton = screen.getByText("Copy to Production");
    await userEvent.click(copyButton);

    expect(createActionClassAction).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("environments.actions.action_with_key_already_exists");
  });

  test("shows error if copy action fails server-side", async () => {
    vi.mocked(createActionClassAction).mockResolvedValue({ data: undefined });
    render(
      <ActionActivityTab
        actionClass={mockActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={false}
      />
    );

    await screen.findByText("Copy to Production");
    const copyButton = screen.getByText("Copy to Production");
    await userEvent.click(copyButton);

    expect(createActionClassAction).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("environments.actions.action_copy_failed");
  });

  test("shows error and prevents copy if user is read-only", async () => {
    render(
      <ActionActivityTab
        actionClass={mockActionClass}
        environmentId="env1_dev"
        environment={mockEnvironmentDev}
        otherEnvActionClasses={mockOtherEnvActionClasses}
        otherEnvironment={mockEnvironmentProd}
        isReadOnly={true} // Set to read-only
      />
    );

    await screen.findByText("Copy to Production");
    const copyButton = screen.getByText("Copy to Production");
    await userEvent.click(copyButton);

    expect(createActionClassAction).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("common.you_are_not_authorised_to_perform_this_action");
  });

  test("renders correct copy button text for production environment", async () => {
    render(
      <ActionActivityTab
        actionClass={{ ...mockActionClass, environmentId: "env1_prod" }}
        environmentId="env1_prod"
        environment={mockEnvironmentProd} // Current env is Production
        otherEnvActionClasses={[]} // Assume dev env has no actions for simplicity
        otherEnvironment={mockEnvironmentDev} // Target env is Development
        isReadOnly={false}
      />
    );
    await screen.findByText("Copy to Development");
    expect(screen.getByText("Copy to Development")).toBeInTheDocument();
    expect(screen.getByText("Production")).toBeInTheDocument(); // Environment text
  });
});
