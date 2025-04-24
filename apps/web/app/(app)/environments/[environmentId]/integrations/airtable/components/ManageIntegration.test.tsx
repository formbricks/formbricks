import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationAirtable, TIntegrationAirtableConfig } from "@formbricks/types/integration/airtable";
import { ManageIntegration } from "./ManageIntegration";

vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  deleteIntegrationAction: vi.fn(),
}));
vi.mock(
  "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AddIntegrationModal",
  () => ({
    AddIntegrationModal: ({ open, setOpenWithStates }) =>
      open ? (
        <div data-testid="add-modal">
          <button onClick={() => setOpenWithStates(false)}>close</button>
        </div>
      ) : null,
  })
);
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, setOpen, onDelete }) =>
    open ? (
      <div data-testid="delete-dialog">
        <button onClick={onDelete}>confirm</button>
        <button onClick={() => setOpen(false)}>cancel</button>
      </div>
    ) : null,
}));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseProps = {
  environment: { id: "env1" } as TEnvironment,
  environmentId: "env1",
  setIsConnected: vi.fn(),
  surveys: [],
  airtableArray: [],
  locale: "en-US" as const,
};

describe("ManageIntegration", () => {
  afterEach(() => {
    cleanup();
  });

  test("empty state", () => {
    render(
      <ManageIntegration
        {...baseProps}
        airtableIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] } as unknown as TIntegrationAirtableConfig,
          } as TIntegrationAirtable
        }
      />
    );
    expect(screen.getByText(/no_integrations_yet/)).toBeInTheDocument();
    expect(screen.getByText(/link_new_table/)).toBeInTheDocument();
  });

  test("open add modal", async () => {
    render(
      <ManageIntegration
        {...baseProps}
        airtableIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] } as unknown as TIntegrationAirtableConfig,
          } as TIntegrationAirtable
        }
      />
    );
    await userEvent.click(screen.getByText(/link_new_table/));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
  });

  test("list integrations and open edit modal", async () => {
    const item = {
      baseId: "b",
      tableId: "t",
      surveyId: "s",
      surveyName: "S",
      tableName: "T",
      questions: "Q",
      questionIds: ["x"],
      createdAt: new Date(),
      includeVariables: false,
      includeHiddenFields: false,
      includeMetadata: false,
      includeCreatedAt: false,
    };
    render(
      <ManageIntegration
        {...baseProps}
        airtableIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [item] } as unknown as TIntegrationAirtableConfig,
          } as TIntegrationAirtable
        }
      />
    );
    expect(screen.getByText("S")).toBeInTheDocument();
    await userEvent.click(screen.getByText("S"));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
  });

  test("delete integration success", async () => {
    vi.mocked(deleteIntegrationAction).mockResolvedValue({ data: true } as any);
    render(
      <ManageIntegration
        {...baseProps}
        airtableIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] } as unknown as TIntegrationAirtableConfig,
          } as TIntegrationAirtable
        }
      />
    );
    await userEvent.click(screen.getByText(/delete_integration/));
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByText("confirm"));
    expect(deleteIntegrationAction).toHaveBeenCalledWith({ integrationId: "1" });
    const { toast } = await import("react-hot-toast");
    expect(toast.success).toHaveBeenCalled();
    expect(baseProps.setIsConnected).toHaveBeenCalledWith(false);
  });

  test("delete integration error", async () => {
    vi.mocked(deleteIntegrationAction).mockResolvedValue({ error: "fail" } as any);
    render(
      <ManageIntegration
        {...baseProps}
        airtableIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] } as unknown as TIntegrationAirtableConfig,
          } as TIntegrationAirtable
        }
      />
    );
    await userEvent.click(screen.getByText(/delete_integration/));
    await userEvent.click(screen.getByText("confirm"));
    const { toast } = await import("react-hot-toast");
    expect(toast.error).toHaveBeenCalled();
  });
});
