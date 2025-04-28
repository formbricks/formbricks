import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  TIntegrationNotion,
  TIntegrationNotionConfig,
  TIntegrationNotionConfigData,
  TIntegrationNotionCredential,
} from "@formbricks/types/integration/notion";
import { ManageIntegration } from "./ManageIntegration";

vi.mock("react-hot-toast", () => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/time", () => ({ timeSince: () => "ago" }));
vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  deleteIntegrationAction: vi.fn(),
}));

describe("ManageIntegration", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    environment: {} as any,
    locale: "en-US" as const,
    setOpenAddIntegrationModal: vi.fn(),
    setIsConnected: vi.fn(),
    setSelectedIntegration: vi.fn(),
    handleNotionAuthorization: vi.fn(),
  };

  test("shows empty state when no databases", () => {
    render(
      <ManageIntegration
        {...defaultProps}
        notionIntegration={
          {
            id: "1",
            config: {
              data: [] as TIntegrationNotionConfigData[],
              key: { workspace_name: "ws" } as TIntegrationNotionCredential,
            } as TIntegrationNotionConfig,
          } as TIntegrationNotion
        }
      />
    );
    expect(screen.getByText("environments.integrations.notion.no_databases_found")).toBeInTheDocument();
  });

  test("renders list and handles clicks", async () => {
    const data = [
      { surveyName: "S", databaseName: "D", createdAt: new Date().toISOString(), databaseId: "db" },
    ] as unknown as TIntegrationNotionConfigData[];
    render(
      <ManageIntegration
        {...defaultProps}
        notionIntegration={
          {
            id: "1",
            config: { data, key: { workspace_name: "ws" } as TIntegrationNotionCredential },
          } as TIntegrationNotion
        }
      />
    );
    expect(screen.getByText("S")).toBeInTheDocument();
    await userEvent.click(screen.getByText("S"));
    expect(defaultProps.setSelectedIntegration).toHaveBeenCalledWith({ ...data[0], index: 0 });
    expect(defaultProps.setOpenAddIntegrationModal).toHaveBeenCalled();
  });

  test("update and link new buttons invoke handlers", async () => {
    render(
      <ManageIntegration
        {...defaultProps}
        notionIntegration={
          {
            id: "1",
            config: {
              data: [],
              key: { workspace_name: "ws" } as TIntegrationNotionCredential,
            } as TIntegrationNotionConfig,
          } as TIntegrationNotion
        }
      />
    );
    await userEvent.click(screen.getByText("environments.integrations.notion.update_connection"));
    expect(defaultProps.handleNotionAuthorization).toHaveBeenCalled();
    await userEvent.click(screen.getByText("environments.integrations.notion.link_new_database"));
    expect(defaultProps.setOpenAddIntegrationModal).toHaveBeenCalled();
  });
});
