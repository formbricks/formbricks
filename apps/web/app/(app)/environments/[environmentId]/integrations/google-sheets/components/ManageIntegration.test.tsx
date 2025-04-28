import { deleteIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { ManageIntegration } from "./ManageIntegration";

vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  deleteIntegrationAction: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

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
  locale: "en-US" as const,
} as const;

describe("ManageIntegration (Google Sheets)", () => {
  afterEach(() => {
    cleanup();
  });

  test("empty state", () => {
    render(
      <ManageIntegration
        {...baseProps}
        googleSheetIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] },
          } as unknown as TIntegrationGoogleSheets
        }
      />
    );

    expect(screen.getByText(/no_integrations_yet/)).toBeInTheDocument();
    expect(screen.getByText(/link_new_sheet/)).toBeInTheDocument();
  });

  test("click link new sheet", async () => {
    render(
      <ManageIntegration
        {...baseProps}
        googleSheetIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] },
          } as unknown as TIntegrationGoogleSheets
        }
      />
    );

    await userEvent.click(screen.getByText(/link_new_sheet/));

    expect(baseProps.setSelectedIntegration).toHaveBeenCalledWith(null);
    expect(baseProps.setOpenAddIntegrationModal).toHaveBeenCalledWith(true);
  });

  test("list integrations and open edit", async () => {
    const item = {
      spreadsheetId: "sid",
      spreadsheetName: "SheetName",
      surveyId: "s1",
      surveyName: "Survey1",
      questionIds: ["q1"],
      questions: "Q",
      createdAt: new Date(),
    };

    render(
      <ManageIntegration
        {...baseProps}
        googleSheetIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [item] },
          } as unknown as TIntegrationGoogleSheets
        }
      />
    );

    expect(screen.getByText("Survey1")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Survey1"));

    expect(baseProps.setSelectedIntegration).toHaveBeenCalledWith({
      ...item,
      index: 0,
    });
    expect(baseProps.setOpenAddIntegrationModal).toHaveBeenCalledWith(true);
  });

  test("delete integration success", async () => {
    vi.mocked(deleteIntegrationAction).mockResolvedValue({ data: true } as any);

    render(
      <ManageIntegration
        {...baseProps}
        googleSheetIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] },
          } as unknown as TIntegrationGoogleSheets
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
        googleSheetIntegration={
          {
            id: "1",
            config: { email: "a@b.com", data: [] },
          } as unknown as TIntegrationGoogleSheets
        }
      />
    );

    await userEvent.click(screen.getByText(/delete_integration/));
    await userEvent.click(screen.getByText("confirm"));

    const { default: toast } = await import("react-hot-toast");
    expect(toast.error).toHaveBeenCalledWith(expect.any(String));
  });
});
