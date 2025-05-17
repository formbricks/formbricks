import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTableToolbar } from "./data-table-toolbar";

// Mock TooltipRenderer
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ children, tooltipContent }) => (
    <div data-testid="tooltip-renderer" data-tooltip-content={tooltipContent}>
      {children}
    </div>
  ),
}));

// Mock SelectedRowSettings
vi.mock("./selected-row-settings", () => ({
  SelectedRowSettings: vi.fn(() => <div data-testid="selected-row-settings"></div>),
}));

// Mock useTranslate
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key) => key,
  }),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...actual,
    RefreshCcwIcon: vi.fn((props) => <div data-testid="refresh-ccw-icon" {...props} />),
    SettingsIcon: vi.fn((props) => <div data-testid="settings-icon" {...props} />),
    MoveVerticalIcon: vi.fn((props) => <div data-testid="move-vertical-icon" {...props} />),
  };
});

const mockTable = {
  getFilteredSelectedRowModel: vi.fn(() => ({ rows: [] })),
} as any;

const mockDeleteRowsAction = vi.fn();
const mockDeleteAction = vi.fn();
const mockDownloadRowsAction = vi.fn();
const mockRefreshContacts = vi.fn();
const mockSetIsExpanded = vi.fn();
const mockSetIsTableSettingsModalOpen = vi.fn();

const defaultProps = {
  setIsExpanded: mockSetIsExpanded,
  setIsTableSettingsModalOpen: mockSetIsTableSettingsModalOpen,
  isExpanded: false,
  table: mockTable,
  deleteRowsAction: mockDeleteRowsAction,
  type: "response" as "response" | "contact",
  deleteAction: mockDeleteAction,
  downloadRowAction: mockDownloadRowsAction,
  refreshContacts: mockRefreshContacts,
};

describe("DataTableToolbar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with no selected rows", () => {
    render(<DataTableToolbar {...defaultProps} />);
    expect(screen.queryByTestId("selected-row-settings")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-icon")).toBeInTheDocument();
    expect(screen.getByTestId("move-vertical-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("refresh-ccw-icon")).not.toBeInTheDocument();
  });

  test("renders SelectedRowSettings when rows are selected", () => {
    const tableWithSelectedRows = {
      getFilteredSelectedRowModel: vi.fn(() => ({ rows: [{ id: "1" }] })),
    } as any;
    render(<DataTableToolbar {...defaultProps} table={tableWithSelectedRows} />);
    expect(screen.getByTestId("selected-row-settings")).toBeInTheDocument();
  });

  test("renders refresh icon for contact type and calls refreshContacts on click", async () => {
    mockRefreshContacts.mockResolvedValueOnce(undefined);
    render(<DataTableToolbar {...defaultProps} type="contact" />);
    const refreshIconContainer = screen.getByTestId("refresh-ccw-icon").parentElement;
    expect(refreshIconContainer).toBeInTheDocument();
    await userEvent.click(refreshIconContainer!);
    expect(mockRefreshContacts).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "environments.contacts.contacts_table_refresh_success"
    );
  });

  test("handles refreshContacts failure", async () => {
    mockRefreshContacts.mockRejectedValueOnce(new Error("Refresh failed"));
    render(<DataTableToolbar {...defaultProps} type="contact" />);
    const refreshIconContainer = screen.getByTestId("refresh-ccw-icon").parentElement;
    await userEvent.click(refreshIconContainer!);
    expect(mockRefreshContacts).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("environments.contacts.contacts_table_refresh_error");
  });

  test("does not render refresh icon for response type", () => {
    render(<DataTableToolbar {...defaultProps} type="response" />);
    expect(screen.queryByTestId("refresh-ccw-icon")).not.toBeInTheDocument();
  });

  test("calls setIsTableSettingsModalOpen when settings icon is clicked", async () => {
    render(<DataTableToolbar {...defaultProps} />);
    const settingsIconContainer = screen.getByTestId("settings-icon").parentElement;
    await userEvent.click(settingsIconContainer!);
    expect(mockSetIsTableSettingsModalOpen).toHaveBeenCalledWith(true);
  });

  test("calls setIsExpanded when move vertical icon is clicked (isExpanded false)", async () => {
    render(<DataTableToolbar {...defaultProps} isExpanded={false} />);
    const moveIconContainer = screen.getByTestId("move-vertical-icon").parentElement;
    const tooltip = moveIconContainer?.closest('[data-testid="tooltip-renderer"]');
    expect(tooltip).toHaveAttribute("data-tooltip-content", "common.expand_rows");
    await userEvent.click(moveIconContainer!);
    expect(mockSetIsExpanded).toHaveBeenCalledWith(true);
  });

  test("calls setIsExpanded when move vertical icon is clicked (isExpanded true)", async () => {
    render(<DataTableToolbar {...defaultProps} isExpanded={true} />);
    const moveIconContainer = screen.getByTestId("move-vertical-icon").parentElement;
    const tooltip = moveIconContainer?.closest('[data-testid="tooltip-renderer"]');
    expect(tooltip).toHaveAttribute("data-tooltip-content", "common.collapse_rows");
    await userEvent.click(moveIconContainer!);
    expect(mockSetIsExpanded).toHaveBeenCalledWith(false);
    expect(moveIconContainer).toHaveClass("bg-black text-white");
  });
});
