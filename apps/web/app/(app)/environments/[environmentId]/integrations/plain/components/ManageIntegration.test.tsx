import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationPlain, TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";
import { ManageIntegration } from "./ManageIntegration";

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

vi.mock("@/lib/constants", () => {
  const base = {
    IS_FORMBRICKS_CLOUD: false,
    IS_PRODUCTION: false,
    IS_DEVELOPMENT: true,
    E2E_TESTING: false,
    ENCRYPTION_KEY: "12345678901234567890123456789012",
    REDIS_URL: undefined,
    ENTERPRISE_LICENSE_KEY: undefined,
    POSTHOG_API_KEY: undefined,
    POSTHOG_HOST: undefined,
    IS_POSTHOG_CONFIGURED: false,
    GITHUB_ID: undefined,
    GITHUB_SECRET: undefined,
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    AZUREAD_CLIENT_ID: undefined,
    AZUREAD_CLIENT_SECRET: undefined,
    AZUREAD_TENANT_ID: undefined,
    OIDC_DISPLAY_NAME: undefined,
    OIDC_CLIENT_ID: undefined,
    OIDC_ISSUER: undefined,
    OIDC_CLIENT_SECRET: undefined,
    OIDC_SIGNING_ALGORITHM: undefined,
    SESSION_MAX_AGE: 1000,
    AUDIT_LOG_ENABLED: 1,
    WEBAPP_URL: undefined,
    SENTRY_DSN: undefined,
    SENTRY_RELEASE: undefined,
    SENTRY_ENVIRONMENT: undefined,
  };
  return new Proxy(base, {
    get(target, prop) {
      return prop in target ? target[prop as keyof typeof target] : undefined;
    },
  });
});

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key) => key,
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

  beforeEach(() => {
    setOpenAddIntegrationModal = vi.fn();
    setIsConnected = vi.fn();
    setSelectedIntegration = vi.fn();
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
