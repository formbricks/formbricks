import { ResponseTable } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTable";
import { getResponsesDownloadUrlAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUserLocale } from "@formbricks/types/user";

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

// Mock DndContext/SortableContext
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  useSensor: vi.fn(),
  useSensors: vi.fn(() => "sensors"),
  closestCenter: vi.fn(),
  MouseSensor: vi.fn(),
  TouchSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
}));

vi.mock("@dnd-kit/modifiers", () => ({
  restrictToHorizontalAxis: "restrictToHorizontalAxis",
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  horizontalListSortingStrategy: "horizontalListSortingStrategy",
  arrayMove: vi.fn((arr, oldIndex, newIndex) => {
    const result = [...arr];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex, 0, removed);
    return result;
  }),
}));

// Mock AutoAnimate
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [vi.fn()],
}));

// Mock UI components
vi.mock("@/modules/ui/components/data-table", () => ({
  DataTableHeader: ({ header }: any) => <th data-testid={`header-${header.id}`}>{header.id}</th>,
  DataTableSettingsModal: ({ open, setOpen }: any) =>
    open ? (
      <div data-testid="settings-modal">
        Settings Modal <button onClick={() => setOpen(false)}>Close</button>
      </div>
    ) : null,
  DataTableToolbar: ({
    table,
    deleteRowsAction,
    downloadRowsAction,
    setIsTableSettingsModalOpen,
    setIsExpanded,
    isExpanded,
  }: any) => (
    <div data-testid="table-toolbar">
      <button data-testid="toggle-expand" onClick={() => setIsExpanded(!isExpanded)}>
        Toggle Expand
      </button>
      <button data-testid="open-settings" onClick={() => setIsTableSettingsModalOpen(true)}>
        Open Settings
      </button>
      <button
        data-testid="delete-rows"
        onClick={() => deleteRowsAction(Object.keys(table.getState().rowSelection))}>
        Delete Selected
      </button>
      <button
        data-testid="download-csv"
        onClick={() => downloadRowsAction(Object.keys(table.getState().rowSelection), "csv")}>
        Download CSV
      </button>
      <button
        data-testid="download-xlsx"
        onClick={() => downloadRowsAction(Object.keys(table.getState().rowSelection), "xlsx")}>
        Download XLSX
      </button>
    </div>
  ),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCardModal",
  () => ({
    ResponseCardModal: ({ open, setOpen }: any) =>
      open ? (
        <div data-testid="response-modal">
          Response Modal <button onClick={() => setOpen(false)}>Close</button>
        </div>
      ) : null,
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableCell",
  () => ({
    ResponseTableCell: ({ cell, row, setSelectedResponseId }: any) => (
      <td data-testid={`cell-${cell.id}-${row.id}`} onClick={() => setSelectedResponseId(row.id)}>
        Cell Content
      </td>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableColumns",
  () => ({
    generateResponseTableColumns: vi.fn(() => [
      { id: "select", accessorKey: "select", header: "Select" },
      { id: "createdAt", accessorKey: "createdAt", header: "Created At" },
      { id: "person", accessorKey: "person", header: "Person" },
      { id: "status", accessorKey: "status", header: "Status" },
    ]),
  })
);

vi.mock("@/modules/ui/components/table", () => ({
  Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableHeader: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));

vi.mock("@/modules/ui/components/skeleton", () => ({
  Skeleton: ({ children }: any) => <div data-testid="skeleton">{children}</div>,
}));

// Mock the actions
vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions", () => ({
  getResponsesDownloadUrlAction: vi.fn(),
}));

vi.mock("@/modules/analysis/components/SingleResponseCard/actions", () => ({
  deleteResponseAction: vi.fn(),
}));

// Mock helper functions
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
  };
})();
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

// Mock Tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Define mock data for tests
const mockProps = {
  data: [
    { responseId: "resp1", createdAt: new Date().toISOString(), status: "completed", person: "Person 1" },
    { responseId: "resp2", createdAt: new Date().toISOString(), status: "completed", person: "Person 2" },
  ] as any[],
  survey: {
    id: "survey1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "name",
    type: "link",
    environmentId: "env-1",
    createdBy: null,
    status: "draft",
  } as TSurvey,
  responses: [
    { id: "resp1", surveyId: "survey1", data: {}, createdAt: new Date(), updatedAt: new Date() },
    { id: "resp2", surveyId: "survey1", data: {}, createdAt: new Date(), updatedAt: new Date() },
  ] as TResponse[],
  environment: { id: "env1" } as TEnvironment,
  environmentTags: [] as TTag[],
  isReadOnly: false,
  fetchNextPage: vi.fn(),
  hasMore: false,
  deleteResponses: vi.fn(),
  updateResponse: vi.fn(),
  isFetchingFirstPage: false,
  locale: "en" as TUserLocale,
};

// Setup a container for React Testing Library before each test
beforeEach(() => {
  const container = document.createElement("div");
  container.id = "test-container";
  document.body.appendChild(container);

  // Reset all toast mocks before each test
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();

  // Create a mock anchor element for download tests
  const mockAnchor = {
    href: "",
    click: vi.fn(),
    style: {},
  };

  // Update how we mock the document methods to avoid infinite recursion
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "a") return mockAnchor as any;
    return originalCreateElement(tagName);
  });

  vi.spyOn(document.body, "appendChild").mockReturnValue(null as any);
  vi.spyOn(document.body, "removeChild").mockReturnValue(null as any);
});

// Cleanup after each test
afterEach(() => {
  const container = document.getElementById("test-container");
  if (container) {
    document.body.removeChild(container);
  }
  cleanup();
  vi.restoreAllMocks(); // Restore mocks after each test
});

describe("ResponseTable", () => {
  afterEach(() => {
    cleanup(); // Keep cleanup within describe as per instructions
  });

  test("renders the table with data", () => {
    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByTestId("table-toolbar")).toBeInTheDocument();
  });

  test("renders no results message when data is empty", () => {
    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} data={[]} responses={[]} />, { container: container! });
    expect(screen.getByText("common.no_results")).toBeInTheDocument();
  });

  test("renders load more button when hasMore is true", () => {
    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} hasMore={true} />, { container: container! });
    expect(screen.getByText("common.load_more")).toBeInTheDocument();
  });

  test("calls fetchNextPage when load more button is clicked", async () => {
    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} hasMore={true} />, { container: container! });
    const loadMoreButton = screen.getByText("common.load_more");
    await userEvent.click(loadMoreButton);
    expect(mockProps.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test("opens settings modal when toolbar button is clicked", async () => {
    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const openSettingsButton = screen.getByTestId("open-settings");
    await userEvent.click(openSettingsButton);
    expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
  });

  test("toggles expanded state when toolbar button is clicked", async () => {
    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const toggleExpandButton = screen.getByTestId("toggle-expand");

    // Initially might be null, first click should set it to true
    await userEvent.click(toggleExpandButton);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith("survey1-rowExpand", expect.any(String));
  });

  test("calls downloadSelectedRows with csv format when toolbar button is clicked", async () => {
    vi.mocked(getResponsesDownloadUrlAction).mockResolvedValueOnce({
      data: "https://download.url/file.csv",
    });

    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const downloadCsvButton = screen.getByTestId("download-csv");
    await userEvent.click(downloadCsvButton);

    expect(getResponsesDownloadUrlAction).toHaveBeenCalledWith({
      surveyId: "survey1",
      format: "csv",
      filterCriteria: { responseIds: [] },
    });

    // Check if link was created and clicked
    expect(document.createElement).toHaveBeenCalledWith("a");
    const mockLink = document.createElement("a");
    expect(mockLink.href).toBe("https://download.url/file.csv");
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  test("calls downloadSelectedRows with xlsx format when toolbar button is clicked", async () => {
    vi.mocked(getResponsesDownloadUrlAction).mockResolvedValueOnce({
      data: "https://download.url/file.xlsx",
    });

    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const downloadXlsxButton = screen.getByTestId("download-xlsx");
    await userEvent.click(downloadXlsxButton);

    expect(getResponsesDownloadUrlAction).toHaveBeenCalledWith({
      surveyId: "survey1",
      format: "xlsx",
      filterCriteria: { responseIds: [] },
    });

    // Check if link was created and clicked
    expect(document.createElement).toHaveBeenCalledWith("a");
    const mockLink = document.createElement("a");
    expect(mockLink.href).toBe("https://download.url/file.xlsx");
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  // Test response modal
  test("opens and closes response modal when a cell is clicked", async () => {
    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const cell = screen.getByTestId("cell-resp1_select-resp1");
    await userEvent.click(cell);
    expect(screen.getByTestId("response-modal")).toBeInTheDocument();
    // Close the modal
    const closeButton = screen.getByText("Close");
    await userEvent.click(closeButton);

    // Modal should be closed now
    expect(screen.queryByTestId("response-modal")).not.toBeInTheDocument();
  });

  test("shows error toast when download action returns error", async () => {
    const errorMsg = "Download failed";
    vi.mocked(getResponsesDownloadUrlAction).mockResolvedValueOnce({
      data: undefined,
      serverError: errorMsg,
    });
    vi.mocked(getFormattedErrorMessage).mockReturnValueOnce(errorMsg);

    // Reset document.createElement spy to fix the last test
    vi.mocked(document.createElement).mockClear();

    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const downloadCsvButton = screen.getByTestId("download-csv");
    await userEvent.click(downloadCsvButton);

    await waitFor(() => {
      expect(getResponsesDownloadUrlAction).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("environments.surveys.responses.error_downloading_responses");
    });
  });

  test("shows default error toast when download action returns no data", async () => {
    vi.mocked(getResponsesDownloadUrlAction).mockResolvedValueOnce({
      data: undefined,
    });
    vi.mocked(getFormattedErrorMessage).mockReturnValueOnce("");

    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const downloadCsvButton = screen.getByTestId("download-csv");
    await userEvent.click(downloadCsvButton);

    await waitFor(() => {
      expect(getResponsesDownloadUrlAction).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("environments.surveys.responses.error_downloading_responses");
    });
  });

  test("shows error toast when download action throws exception", async () => {
    vi.mocked(getResponsesDownloadUrlAction).mockRejectedValueOnce(new Error("Network error"));

    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const downloadCsvButton = screen.getByTestId("download-csv");
    await userEvent.click(downloadCsvButton);

    await waitFor(() => {
      expect(getResponsesDownloadUrlAction).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("environments.surveys.responses.error_downloading_responses");
    });
  });

  test("does not create download link when download action fails", async () => {
    // Clear any previous calls to document.createElement
    vi.mocked(document.createElement).mockClear();

    vi.mocked(getResponsesDownloadUrlAction).mockResolvedValueOnce({
      data: undefined,
      serverError: "Download failed",
    });

    // Create a fresh spy for createElement for this test only
    const createElementSpy = vi.spyOn(document, "createElement");

    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });
    const downloadCsvButton = screen.getByTestId("download-csv");
    await userEvent.click(downloadCsvButton);

    await waitFor(() => {
      expect(getResponsesDownloadUrlAction).toHaveBeenCalled();
      // Check specifically for "a" element creation, not any element
      expect(createElementSpy).not.toHaveBeenCalledWith("a");
    });
  });

  test("loads saved settings from localStorage on mount", () => {
    const columnOrder = ["status", "person", "createdAt", "select"];
    const columnVisibility = { status: false };
    const isExpanded = true;

    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === "survey1-columnOrder") return JSON.stringify(columnOrder);
      if (key === "survey1-columnVisibility") return JSON.stringify(columnVisibility);
      if (key === "survey1-rowExpand") return JSON.stringify(isExpanded);
      return null;
    });

    const container = document.getElementById("test-container");
    render(<ResponseTable {...mockProps} />, { container: container! });

    expect(mockLocalStorage.getItem).toHaveBeenCalledWith("survey1-columnOrder");
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith("survey1-columnVisibility");
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith("survey1-rowExpand");
  });
});
