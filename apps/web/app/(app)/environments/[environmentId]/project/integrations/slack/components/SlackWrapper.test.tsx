import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack, TIntegrationSlackCredential } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getSlackChannelsAction } from "../actions";
import { authorize } from "../lib/slack";
import { SlackWrapper } from "./SlackWrapper";

// Mock child components and actions
vi.mock("@/app/(app)/environments/[environmentId]/integrations/slack/actions", () => ({
  getSlackChannelsAction: vi.fn(),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/integrations/slack/components/AddChannelMappingModal",
  () => ({
    AddChannelMappingModal: vi.fn(({ open }) => (open ? <div data-testid="add-modal">Add Modal</div> : null)),
  })
);

vi.mock("@/app/(app)/environments/[environmentId]/integrations/slack/components/ManageIntegration", () => ({
  ManageIntegration: vi.fn(({ setOpenAddIntegrationModal, setIsConnected, handleSlackAuthorization }) => (
    <div data-testid="manage-integration">
      <button onClick={() => setOpenAddIntegrationModal(true)}>Open Modal</button>
      <button onClick={() => setIsConnected(false)}>Disconnect</button>
      <button onClick={handleSlackAuthorization}>Reconnect</button>
    </div>
  )),
}));

vi.mock("@/app/(app)/environments/[environmentId]/integrations/slack/lib/slack", () => ({
  authorize: vi.fn(),
}));

vi.mock("@/images/slacklogo.png", () => ({
  default: "slack-logo-path",
}));

vi.mock("@/modules/ui/components/connect-integration", () => ({
  ConnectIntegration: vi.fn(({ handleAuthorization, isEnabled }) => (
    <div data-testid="connect-integration">
      <button onClick={handleAuthorization} disabled={!isEnabled}>
        Connect
      </button>
    </div>
  )),
}));

// Mock window.location.replace
Object.defineProperty(window, "location", {
  value: {
    replace: vi.fn(),
  },
  writable: true,
});

const mockEnvironment = { id: "test-env-id" } as TEnvironment;
const mockSurveys: TSurvey[] = [];
const mockWebAppUrl = "http://localhost:3000";
const mockLocale: TUserLocale = "en-US";
const mockSlackChannels: TIntegrationItem[] = [{ id: "C123", name: "general" }];

const mockSlackIntegration: TIntegrationSlack = {
  id: "slack-int-1",
  type: "slack",
  environmentId: "test-env-id",
  config: {
    key: { access_token: "xoxb-valid-token" } as unknown as TIntegrationSlackCredential,
    data: [],
  },
};

const baseProps = {
  environment: mockEnvironment,
  surveys: mockSurveys,
  webAppUrl: mockWebAppUrl,
  locale: mockLocale,
};

describe("SlackWrapper", () => {
  beforeEach(() => {
    vi.mocked(getSlackChannelsAction).mockResolvedValue({ data: mockSlackChannels });
    vi.mocked(authorize).mockResolvedValue("https://slack.com/auth");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders ConnectIntegration when not connected (no integration)", () => {
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={undefined} />);
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
  });

  test("renders ConnectIntegration when not connected (integration without key)", () => {
    const integrationWithoutKey = { ...mockSlackIntegration, config: { data: [], email: "test" } } as any;
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={integrationWithoutKey} />);
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });

  test("renders ConnectIntegration disabled when isEnabled is false", () => {
    render(<SlackWrapper {...baseProps} isEnabled={false} slackIntegration={undefined} />);
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  test("calls authorize and redirects when Connect button is clicked", async () => {
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={undefined} />);
    const connectButton = screen.getByRole("button", { name: "Connect" });
    await userEvent.click(connectButton);

    expect(authorize).toHaveBeenCalledWith(mockEnvironment.id, mockWebAppUrl);
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith("https://slack.com/auth");
    });
  });

  test("renders ManageIntegration and AddChannelMappingModal (hidden) when connected", () => {
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={mockSlackIntegration} />);
    expect(screen.getByTestId("manage-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-integration")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument(); // Modal is initially hidden
  });

  test("calls getSlackChannelsAction on mount", async () => {
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={mockSlackIntegration} />);
    await waitFor(() => {
      expect(getSlackChannelsAction).toHaveBeenCalledWith({ environmentId: mockEnvironment.id });
    });
  });

  test("switches from ManageIntegration to ConnectIntegration when disconnected", async () => {
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={mockSlackIntegration} />);
    expect(screen.getByTestId("manage-integration")).toBeInTheDocument();

    const disconnectButton = screen.getByRole("button", { name: "Disconnect" });
    await userEvent.click(disconnectButton);

    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });

  test("opens AddChannelMappingModal when triggered from ManageIntegration", async () => {
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={mockSlackIntegration} />);
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();

    const openModalButton = screen.getByRole("button", { name: "Open Modal" });
    await userEvent.click(openModalButton);

    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
  });

  test("calls handleSlackAuthorization when reconnect button is clicked in ManageIntegration", async () => {
    render(<SlackWrapper {...baseProps} isEnabled={true} slackIntegration={mockSlackIntegration} />);
    const reconnectButton = screen.getByRole("button", { name: "Reconnect" });
    await userEvent.click(reconnectButton);

    expect(authorize).toHaveBeenCalledWith(mockEnvironment.id, mockWebAppUrl);
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith("https://slack.com/auth");
    });
  });
});
