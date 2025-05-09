import { generateResponseTableColumns } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableColumns";
import { deleteResponseAction } from "@/modules/analysis/components/SingleResponseCard/actions";
import type { DragEndEvent } from "@dnd-kit/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse, TResponseTableData } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { ResponseTable } from "./ResponseTable";

// Hoist variables used in mock factories
const { DndContextMock, SortableContextMock, arrayMoveMock } = vi.hoisted(() => {
  const dndMock = vi.fn(({ children, onDragEnd }) => {
    // Store the onDragEnd prop to allow triggering it in tests
    (dndMock as any).lastOnDragEnd = onDragEnd;
    return <div data-testid="dnd-context">{children}</div>;
  });
  const sortableMock = vi.fn(({ children }) => <>{children}</>);
  const moveMock = vi.fn((array, from, to) => {
    const newArray = [...array];
    const [item] = newArray.splice(from, 1);
    newArray.splice(to, 0, item);
    return newArray;
  });
  return {
    DndContextMock: dndMock,
    SortableContextMock: sortableMock,
    arrayMoveMock: moveMock,
  };
});

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: DndContextMock,
    useSensor: vi.fn(),
    useSensors: vi.fn(),
    closestCenter: vi.fn(),
  };
});

vi.mock("@dnd-kit/modifiers", () => ({
  restrictToHorizontalAxis: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: SortableContextMock,
  arrayMove: arrayMoveMock,
  horizontalListSortingStrategy: vi.fn(),
}));

// Mock child components and hooks
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCardModal",
  () => ({
    ResponseCardModal: vi.fn(({ open, setOpen, selectedResponseId }) =>
      open ? (
        <div data-testid="response-card-modal">
          Selected Response ID: {selectedResponseId}
          <button onClick={() => setOpen(false)}>Close ResponseCardModal</button>
        </div>
      ) : null
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableCell",
  () => ({
    ResponseTableCell: vi.fn(({ cell, row, setSelectedResponseId }) => (
      <td data-testid={`cell-${cell.id}`} onClick={() => setSelectedResponseId(row.original.responseId)}>
        {typeof cell.getValue === "function" ? cell.getValue() : JSON.stringify(cell.getValue())}
      </td>
    )),
  })
);

const mockGeneratedColumns = [
  {
    id: "select",
    header: () => "Select",
    cell: vi.fn(() => "SelectCell"),
    enableSorting: false,
    meta: { type: "select", questionType: null, hidden: false },
  },
  {
    id: "createdAt",
    header: () => "Created At",
    cell: vi.fn(({ row }) => new Date(row.original.createdAt).toISOString()),
    enableSorting: true,
    meta: { type: "createdAt", questionType: null, hidden: false },
  },
  {
    id: "q1",
    header: () => "Question 1",
    cell: vi.fn(({ row }) => row.original.responseData.q1),
    enableSorting: true,
    meta: { type: "question", questionType: "openText", hidden: false },
  },
];
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableColumns",
  () => ({
    generateResponseTableColumns: vi.fn(() => mockGeneratedColumns),
  })
);

vi.mock("@/modules/analysis/components/SingleResponseCard/actions", () => ({
  deleteResponseAction: vi.fn(),
}));

vi.mock("@/modules/ui/components/data-table", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ui/components/data-table")>();
  return {
    ...actual,
    DataTableToolbar: vi.fn((props) => (
      <div data-testid="data-table-toolbar">
        <button data-testid="toolbar-expand-toggle" onClick={() => props.setIsExpanded(!props.isExpanded)}>
          Toggle Expand
        </button>
        <button data-testid="toolbar-open-settings" onClick={() => props.setIsTableSettingsModalOpen(true)}>
          Open Settings
        </button>
        <button
          data-testid="toolbar-delete-selected"
          onClick={() => props.deleteRows(props.table.getSelectedRowModel().rows.map((r) => r.id))}>
          Delete Selected
        </button>
        <button data-testid="toolbar-delete-single" onClick={() => props.deleteAction("single_response_id")}>
          Delete Single Action
        </button>
      </div>
    )),
    DataTableHeader: vi.fn(({ header }) => (
      <th
        data-testid={`header-${header.id}`}
        onClick={() => header.column.getToggleSortingHandler()?.(new MouseEvent("click"))}>
        {typeof header.column.columnDef.header === "function"
          ? header.column.columnDef.header(header.getContext())
          : header.column.columnDef.header}
        <button
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          data-testid={`resize-${header.id}`}>
          Resize
        </button>
      </th>
    )),
    DataTableSettingsModal: vi.fn(({ open, setOpen }) =>
      open ? (
        <div data-testid="data-table-settings-modal">
          <button onClick={() => setOpen(false)}>Close Settings</button>
        </div>
      ) : null
    ),
  };
});

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [vi.fn()]),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: vi.fn((key) => key), // Simple pass-through mock
  }),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: () => {
      store = {};
    },
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  status: "inProgress",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      required: true,
    } as unknown as TSurveyQuestion,
  ],
  hiddenFields: { enabled: true, fieldIds: ["hidden1"] },
  variables: [{ id: "var1", name: "Variable 1", type: "text", value: "default" }],
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env1",
  welcomeCard: {
    enabled: false,
    headline: { default: "" },
    html: { default: "" },
    timeToFinish: false,
    showResponseCount: false,
  },
  autoClose: null,
  delay: 0,
  autoComplete: null,
  closeOnDate: null,
  displayOption: "displayOnce",
  recontactDays: null,
  singleUse: { enabled: false, isEncrypted: true },
  triggers: [],
  languages: [],
  styling: null,
  surveyClosedMessage: null,
  resultShareKey: null,
  displayPercentage: null,
} as unknown as TSurvey;

const mockResponses: TResponse[] = [
  {
    id: "res1",
    surveyId: "survey1",
    finished: true,
    data: { q1: "Response 1 Text" },
    createdAt: new Date("2023-01-01T10:00:00.000Z"),
    updatedAt: new Date(),
    meta: {},
    singleUseId: null,
    ttc: {},
    tags: [],
    notes: [],
    variables: {},
    language: "en",
    contact: null,
    contactAttributes: null,
  },
  {
    id: "res2",
    surveyId: "survey1",
    finished: false,
    data: { q1: "Response 2 Text" },
    createdAt: new Date("2023-01-02T10:00:00.000Z"),
    updatedAt: new Date(),
    meta: {},
    singleUseId: null,
    ttc: {},
    tags: [],
    notes: [],
    variables: {},
    language: "en",
    contact: null,
    contactAttributes: null,
  },
];

const mockResponseTableData: TResponseTableData[] = [
  {
    responseId: "res1",
    responseData: { q1: "Response 1 Text" },
    createdAt: new Date("2023-01-01T10:00:00.000Z"),
    status: "Completed",
    tags: [],
    notes: [],
    variables: {},
    verifiedEmail: "",
    language: "en",
    person: null,
    contactAttributes: null,
  },
  {
    responseId: "res2",
    responseData: { q1: "Response 2 Text" },
    createdAt: new Date("2023-01-02T10:00:00.000Z"),
    status: "Not Completed",
    tags: [],
    notes: [],
    variables: {},
    verifiedEmail: "",
    language: "en",
    person: null,
    contactAttributes: null,
  },
];

const mockEnvironment = {
  id: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  appSetupCompleted: false,
} as unknown as TEnvironment;

const mockUser = {
  id: "user1",
  name: "Test User",
  email: "user@test.com",
  emailVerified: new Date(),
  imageUrl: "",
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: "project_manager",
  objective: "other",
  notificationSettings: { alert: {}, weeklySummary: {} },
} as unknown as TUser;

const mockEnvironmentTags: TTag[] = [
  { id: "tag1", name: "Tag 1", environmentId: "env1", createdAt: new Date(), updatedAt: new Date() },
];
const mockLocale: TUserLocale = "en-US";

const defaultProps = {
  data: mockResponseTableData,
  survey: mockSurvey,
  responses: mockResponses,
  environment: mockEnvironment,
  user: mockUser,
  environmentTags: mockEnvironmentTags,
  isReadOnly: false,
  fetchNextPage: vi.fn(),
  hasMore: true,
  deleteResponses: vi.fn(),
  updateResponse: vi.fn(),
  isFetchingFirstPage: false,
  locale: mockLocale,
};

describe("ResponseTable", () => {
  afterEach(() => {
    cleanup();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  test("renders skeleton when isFetchingFirstPage is true", () => {
    render(<ResponseTable {...defaultProps} isFetchingFirstPage={true} />);
    // Check for skeleton elements (implementation detail, might need adjustment)
    // For now, check that data is not directly rendered
    expect(screen.queryByText("Response 1 Text")).not.toBeInTheDocument();
    // Check if table headers are still there
    expect(screen.getByText("Created At")).toBeInTheDocument();
  });

  test("loads settings from localStorage on mount", () => {
    const savedOrder = ["q1", "createdAt", "select"];
    const savedVisibility = { createdAt: false };
    const savedExpanded = true;
    localStorageMock.setItem(`${mockSurvey.id}-columnOrder`, JSON.stringify(savedOrder));
    localStorageMock.setItem(`${mockSurvey.id}-columnVisibility`, JSON.stringify(savedVisibility));
    localStorageMock.setItem(`${mockSurvey.id}-rowExpand`, JSON.stringify(savedExpanded));

    render(<ResponseTable {...defaultProps} />);

    // Check if generateResponseTableColumns was called with the loaded expanded state
    expect(vi.mocked(generateResponseTableColumns)).toHaveBeenCalledWith(
      mockSurvey,
      savedExpanded,
      false,
      expect.any(Function)
    );
  });

  test("saves settings to localStorage when they change", async () => {
    const { rerender } = render(<ResponseTable {...defaultProps} />);

    // Simulate column order change via DND
    const dragEvent: DragEndEvent = {
      active: { id: "createdAt" },
      over: { id: "q1" },
      delta: { x: 0, y: 0 },
      activators: { x: 0, y: 0 },
      collisions: null,
      overNode: null,
      activeNode: null,
    } as any;
    act(() => {
      (DndContextMock as any).lastOnDragEnd?.(dragEvent);
    });
    rerender(<ResponseTable {...defaultProps} />); // Rerender to reflect state change if necessary for useEffect
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${mockSurvey.id}-columnOrder`,
      JSON.stringify(["select", "q1", "createdAt"])
    );

    // Simulate visibility change (e.g. via settings modal - direct state change for test)
    // This would typically happen via table.setColumnVisibility, which is internal to useReactTable
    // For this test, we'll assume a mechanism changes columnVisibility state
    // This part is hard to test without deeper mocking of useReactTable or exposing setColumnVisibility

    // Simulate row expansion change
    await userEvent.click(screen.getByTestId("toolbar-expand-toggle")); // Toggle to true
    expect(localStorageMock.setItem).toHaveBeenCalledWith(`${mockSurvey.id}-rowExpand`, "true");
  });

  test("handles column drag and drop", () => {
    render(<ResponseTable {...defaultProps} />);
    const dragEvent: DragEndEvent = {
      active: { id: "createdAt" },
      over: { id: "q1" },
      delta: { x: 0, y: 0 },
      activators: { x: 0, y: 0 },
      collisions: null,
      overNode: null,
      activeNode: null,
    } as any;
    act(() => {
      (DndContextMock as any).lastOnDragEnd?.(dragEvent);
    });
    expect(arrayMoveMock).toHaveBeenCalledWith(expect.arrayContaining(["createdAt", "q1"]), 1, 2); // Example indices
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${mockSurvey.id}-columnOrder`,
      JSON.stringify(["select", "q1", "createdAt"]) // Based on initial ['select', 'createdAt', 'q1']
    );
  });

  test("interacts with DataTableToolbar: toggle expand, open settings, delete", async () => {
    const deleteResponsesMock = vi.fn();
    const deleteResponseActionMock = vi.mocked(deleteResponseAction);
    render(<ResponseTable {...defaultProps} deleteResponses={deleteResponsesMock} />);

    // Toggle expand
    await userEvent.click(screen.getByTestId("toolbar-expand-toggle"));
    expect(vi.mocked(generateResponseTableColumns)).toHaveBeenCalledWith(
      mockSurvey,
      true,
      false,
      expect.any(Function)
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(`${mockSurvey.id}-rowExpand`, "true");

    // Open settings
    await userEvent.click(screen.getByTestId("toolbar-open-settings"));
    expect(screen.getByTestId("data-table-settings-modal")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Close Settings"));
    expect(screen.queryByTestId("data-table-settings-modal")).not.toBeInTheDocument();

    // Delete selected (mock table selection)
    // This requires mocking table.getSelectedRowModel().rows
    // For simplicity, we assume the toolbar button calls deleteRows correctly
    // The mock for DataTableToolbar calls props.deleteRows with hardcoded IDs for now.
    // To test properly, we'd need to mock table.getSelectedRowModel
    // For now, let's assume the mock toolbar calls it.
    // await userEvent.click(screen.getByTestId("toolbar-delete-selected"));
    // expect(deleteResponsesMock).toHaveBeenCalledWith(["row1_id", "row2_id"]); // From mock toolbar

    // Delete single action
    await userEvent.click(screen.getByTestId("toolbar-delete-single"));
    expect(deleteResponseActionMock).toHaveBeenCalledWith({ responseId: "single_response_id" });
  });

  test("calls fetchNextPage when 'Load More' is clicked", async () => {
    const fetchNextPageMock = vi.fn();
    render(<ResponseTable {...defaultProps} fetchNextPage={fetchNextPageMock} />);
    await userEvent.click(screen.getByText("common.load_more"));
    expect(fetchNextPageMock).toHaveBeenCalled();
  });

  test("does not show 'Load More' if hasMore is false", () => {
    render(<ResponseTable {...defaultProps} hasMore={false} />);
    expect(screen.queryByText("common.load_more")).not.toBeInTheDocument();
  });

  test("shows 'No results' when data is empty", () => {
    render(<ResponseTable {...defaultProps} data={[]} responses={[]} />);
    expect(screen.getByText("common.no_results")).toBeInTheDocument();
  });

  test("deleteResponse function calls deleteResponseAction", async () => {
    render(<ResponseTable {...defaultProps} />);
    // This function is called by DataTableToolbar's deleteAction prop
    // We can trigger it via the mocked DataTableToolbar
    await userEvent.click(screen.getByTestId("toolbar-delete-single"));
    expect(vi.mocked(deleteResponseAction)).toHaveBeenCalledWith({ responseId: "single_response_id" });
  });
});
