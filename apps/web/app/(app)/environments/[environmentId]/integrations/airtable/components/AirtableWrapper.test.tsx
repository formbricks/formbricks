import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { AirtableWrapper } from "./AirtableWrapper";

// Mock child components
vi.mock(
  "@/app/(app)/environments/[environmentId]/integrations/airtable/components/ManageIntegration",
  () => ({
    ManageIntegration: ({ setIsConnected }) => (
      <div data-testid="manage-integration">
        <button onClick={() => setIsConnected(false)}>Disconnect</button>
      </div>
    ),
  })
);
vi.mock("@/modules/ui/components/connect-integration", () => ({
  ConnectIntegration: ({ handleAuthorization, isEnabled }) => (
    <div data-testid="connect-integration">
      <button onClick={handleAuthorization} disabled={!isEnabled}>
        Connect
      </button>
    </div>
  ),
}));

// Mock library function
vi.mock("@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable", () => ({
  authorize: vi.fn(),
}));

// Mock image import
vi.mock("@/images/airtableLogo.svg", () => ({
  default: "airtable-logo-path",
}));

// Mock window.location.replace
Object.defineProperty(window, "location", {
  value: {
    replace: vi.fn(),
  },
  writable: true,
});

const environmentId = "test-env-id";
const webAppUrl = "https://app.formbricks.com";
const environment = { id: environmentId } as TEnvironment;
const surveys = [];
const airtableArray = [];
const locale = "en-US" as const;

const baseProps = {
  environmentId,
  airtableArray,
  surveys,
  environment,
  webAppUrl,
  locale,
};

describe("AirtableWrapper", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders ConnectIntegration when not connected (no integration)", () => {
    render(<AirtableWrapper {...baseProps} isEnabled={true} airtableIntegration={undefined} />);
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
  });

  test("renders ConnectIntegration when not connected (integration without key)", () => {
    const integrationWithoutKey = { config: {} } as TIntegrationAirtable;
    render(<AirtableWrapper {...baseProps} isEnabled={true} airtableIntegration={integrationWithoutKey} />);
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });

  test("renders ConnectIntegration disabled when isEnabled is false", () => {
    render(<AirtableWrapper {...baseProps} isEnabled={false} airtableIntegration={undefined} />);
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  test("calls authorize and redirects when Connect button is clicked", async () => {
    const mockAuthorize = vi.mocked(authorize);
    const redirectUrl = "https://airtable.com/auth";
    mockAuthorize.mockResolvedValue(redirectUrl);

    render(<AirtableWrapper {...baseProps} isEnabled={true} airtableIntegration={undefined} />);

    const connectButton = screen.getByRole("button", { name: "Connect" });
    await userEvent.click(connectButton);

    expect(mockAuthorize).toHaveBeenCalledWith(environmentId, webAppUrl);
    await vi.waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith(redirectUrl);
    });
  });

  test("renders ManageIntegration when connected", () => {
    const connectedIntegration = {
      id: "int-1",
      config: { key: { access_token: "abc" }, email: "test@test.com", data: [] },
    } as unknown as TIntegrationAirtable;
    render(<AirtableWrapper {...baseProps} isEnabled={true} airtableIntegration={connectedIntegration} />);
    expect(screen.getByTestId("manage-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-integration")).not.toBeInTheDocument();
  });

  test("switches from ManageIntegration to ConnectIntegration when disconnected", async () => {
    const connectedIntegration = {
      id: "int-1",
      config: { key: { access_token: "abc" }, email: "test@test.com", data: [] },
    } as unknown as TIntegrationAirtable;
    render(<AirtableWrapper {...baseProps} isEnabled={true} airtableIntegration={connectedIntegration} />);

    // Initially, ManageIntegration is shown
    expect(screen.getByTestId("manage-integration")).toBeInTheDocument();

    // Simulate disconnection via ManageIntegration's button
    const disconnectButton = screen.getByRole("button", { name: "Disconnect" });
    await userEvent.click(disconnectButton);

    // Now, ConnectIntegration should be shown
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });
});
