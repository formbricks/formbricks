import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationPlain, TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";
import { ManageIntegration } from "./ManageIntegration";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  deleteIntegrationAction: vi.fn(),
}));

vi.mock("@/lib/time", () => ({
  timeSince: vi.fn((time) => `mock-time-since-${time}`),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((err) => err?.message || "An error occurred"),
}));

vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, setOpen, onDelete, text, isDeleting }) =>
    open ? (
      <div>
        <span>{text}</span>
        <button onClick={() => onDelete()}>{isDeleting ? "Deleting..." : "Delete"}</button>
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock("@/modules/ui/components/empty-space-filler", () => ({
  EmptySpaceFiller: ({ emptyMessage }) => <div>{emptyMessage}</div>,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key) => key, // mock translation function
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockEnvironment = { id: "test-env-id" } as TEnvironment;
const mockIntegrationData: TIntegrationPlainConfigData[] = [
  {
    surveyId: "survey-1",
    surveyName: "Survey One",
    createdAt: new Date(),
    mapping: [],
    includeMetadata: true,
    includeHiddenFields: true,
    includeComponents: false,
  },
  {
    surveyId: "survey-2",
    surveyName: "Survey Two",
    createdAt: new Date(),
    mapping: [],
    includeMetadata: true,
    includeHiddenFields: true,
    includeComponents: false,
  },
];

const mockPlainIntegration: TIntegrationPlain = {
  id: "integration-id",
  type: "plain",
  environmentId: "test-env-id",
  config: {
    key: "test-key",
    data: mockIntegrationData,
  },
};

describe("ManageIntegration", () => {
  let setOpenAddIntegrationModal: (isOpen: boolean) => void;
  let setIsConnected: (isConnected: boolean) => void;
  let setSelectedIntegration: (integration: (TIntegrationPlainConfigData & { index: number }) | null) => void;
  let handlePlainAuthorization: () => void;

  beforeEach(() => {
    setOpenAddIntegrationModal = vi.fn();
    setIsConnected = vi.fn();
    setSelectedIntegration = vi.fn();
    handlePlainAuthorization = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("renders empty state when no integrations are configured", () => {
    render(
      <ManageIntegration
        environment={mockEnvironment}
        plainIntegration={{ ...mockPlainIntegration, config: { ...mockPlainIntegration.config, data: [] } }}
        setOpenAddIntegrationModal={setOpenAddIntegrationModal}
        setIsConnected={setIsConnected}
        setSelectedIntegration={setSelectedIntegration}
        locale={"en-US"}
        handlePlainAuthorization={handlePlainAuthorization}
      />
    );
    expect(screen.getByText("environments.integrations.plain.no_databases_found")).toBeInTheDocument();
  });

  test("renders a list of integrations when configured", () => {
    render(
      <ManageIntegration
        environment={mockEnvironment}
        plainIntegration={mockPlainIntegration}
        setOpenAddIntegrationModal={setOpenAddIntegrationModal}
        setIsConnected={setIsConnected}
        setSelectedIntegration={setSelectedIntegration}
        locale={"en-US"}
        handlePlainAuthorization={handlePlainAuthorization}
      />
    );
    expect(screen.getAllByText("Survey One")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Survey Two")[0]).toBeInTheDocument();
  });

  test("handles successful deletion of an integration", async () => {
    vi.mocked(deleteIntegrationAction).mockResolvedValue({ data: mockPlainIntegration });

    render(
      <ManageIntegration
        environment={mockEnvironment}
        plainIntegration={mockPlainIntegration}
        setOpenAddIntegrationModal={setOpenAddIntegrationModal}
        setIsConnected={setIsConnected}
        setSelectedIntegration={setSelectedIntegration}
        locale={"en-US"}
        handlePlainAuthorization={handlePlainAuthorization}
      />
    );

    await userEvent.click(screen.getAllByText("environments.integrations.delete_integration")[0]);
    expect(screen.getByText("environments.integrations.delete_integration_confirmation")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(deleteIntegrationAction).toHaveBeenCalledWith({ integrationId: mockPlainIntegration.id });
    });
  });
});
