import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { ManageIntegration } from "./ManageIntegration";

vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  deleteIntegrationAction: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, setOpen, onDelete }: any) =>
    open ? (
      <div data-testid="delete-dialog">
        <button onClick={onDelete}>confirm</button>
        <button onClick={() => setOpen(false)}>cancel</button>
      </div>
    ) : null,
}));
vi.mock("@/modules/ui/components/empty-space-filler", () => ({
  EmptySpaceFiller: ({ emptyMessage }: any) => <div>{emptyMessage}</div>,
}));

const baseProps = {
  environment: { id: "env1" } as TEnvironment,
  setOpenAddIntegrationModal: vi.fn(),
  setIsConnected: vi.fn(),
  setSelectedIntegration: vi.fn(),
  refreshChannels: vi.fn(),
  handleSlackAuthorization: vi.fn(),
  showReconnectButton: false,
  locale: "en-US" as const,
};

describe("ManageIntegration (Slack)", () => {
  afterEach(() => cleanup());

  test("empty state", () => {
    render(
      <ManageIntegration
        {...baseProps}
        slackIntegration={
          {
            id: "1",
            config: { data: [], key: { team: { name: "team name" } } },
          } as unknown as TIntegrationSlack
        }
      />
    );
    expect(screen.getByText(/connect_your_first_slack_channel/)).toBeInTheDocument();
    expect(screen.getByText(/link_channel/)).toBeInTheDocument();
  });

  test("link channel triggers handlers", async () => {
    render(
      <ManageIntegration
        {...baseProps}
        slackIntegration={
          {
            id: "1",
            config: { data: [], key: { team: { name: "team name" } } },
          } as unknown as TIntegrationSlack
        }
      />
    );
    await userEvent.click(screen.getByText(/link_channel/));
    expect(baseProps.refreshChannels).toHaveBeenCalled();
    expect(baseProps.setSelectedIntegration).toHaveBeenCalledWith(null);
    expect(baseProps.setOpenAddIntegrationModal).toHaveBeenCalledWith(true);
  });

  test("show reconnect button and triggers authorization", async () => {
    render(
      <ManageIntegration
        {...baseProps}
        showReconnectButton={true}
        slackIntegration={
          {
            id: "1",
            config: { data: [], key: { team: { name: "Team" } } },
          } as unknown as TIntegrationSlack
        }
      />
    );
    expect(screen.getByText("environments.integrations.slack.slack_reconnect_button")).toBeInTheDocument();
    await userEvent.click(screen.getByText("environments.integrations.slack.slack_reconnect_button"));
    expect(baseProps.handleSlackAuthorization).toHaveBeenCalled();
  });

  test("list integrations and open edit", async () => {
    const item = {
      surveyName: "S",
      channelName: "C",
      questions: "Q",
      createdAt: new Date().toISOString(),
      surveyId: "s",
      channelId: "c",
    } as unknown as TIntegrationSlackConfigData;
    render(
      <ManageIntegration
        {...baseProps}
        slackIntegration={
          {
            id: "1",
            config: { data: [item], key: { team: { name: "team name" } } },
          } as unknown as TIntegrationSlack
        }
      />
    );
    expect(screen.getByText("S")).toBeInTheDocument();
    await userEvent.click(screen.getByText("S"));
    expect(baseProps.setSelectedIntegration).toHaveBeenCalledWith({ ...item, index: 0 });
    expect(baseProps.setOpenAddIntegrationModal).toHaveBeenCalledWith(true);
  });

  test("delete integration success", async () => {
    vi.mocked(deleteIntegrationAction).mockResolvedValue({ data: true } as any);
    render(
      <ManageIntegration
        {...baseProps}
        slackIntegration={
          {
            id: "1",
            config: { data: [], key: { team: { name: "team name" } } },
          } as unknown as TIntegrationSlack
        }
      />
    );
    await userEvent.click(screen.getByText(/delete_integration/));
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByText("confirm"));
    expect(deleteIntegrationAction).toHaveBeenCalledWith({ integrationId: "1" });
    const { default: toast } = await import("react-hot-toast");
    expect(toast.success).toHaveBeenCalledWith("environments.integrations.integration_removed_successfully");
    expect(baseProps.setIsConnected).toHaveBeenCalledWith(false);
  });

  test("delete integration error", async () => {
    vi.mocked(deleteIntegrationAction).mockResolvedValue({ error: "fail" } as any);
    render(
      <ManageIntegration
        {...baseProps}
        slackIntegration={
          {
            id: "1",
            config: { data: [], key: { team: { name: "team name" } } },
          } as unknown as TIntegrationSlack
        }
      />
    );
    await userEvent.click(screen.getByText(/delete_integration/));
    await userEvent.click(screen.getByText("confirm"));
    const { default: toast } = await import("react-hot-toast");
    expect(toast.error).toHaveBeenCalledWith(expect.any(String));
  });
});
