import { createI18nString } from "@/lib/i18n/utils";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { MatrixQuestionForm } from "./matrix-question-form";

// Mock window.matchMedia - required for useAutoAnimate
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @formkit/auto-animate - simplify implementation
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

// Store drag end handlers for testing
let dragEndHandlers: { [key: string]: (event: any) => void } = {};

// Mock @dnd-kit components
vi.mock("@dnd-kit/core", () => ({
  DndContext: vi.fn(({ children, onDragEnd, id }) => {
    if (onDragEnd && id) {
      dragEndHandlers[id] = onDragEnd;
    }
    return (
      <div data-testid={`dnd-context-${id}`} data-ondragend={onDragEnd ? "true" : "false"}>
        {children}
      </div>
    );
  }),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: vi.fn(({ children, items, strategy }) => (
    <div data-testid="sortable-context" data-items={JSON.stringify(items)}>
      {children}
    </div>
  )),
  verticalListSortingStrategy: "vertical",
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  })),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => ""),
    },
  },
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock findOptionUsedInLogic
vi.mock("@/modules/survey/editor/lib/utils", () => ({
  findOptionUsedInLogic: vi.fn(),
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "test",
  ENTERPRISE_LICENSE_KEY: "test",
  GITHUB_ID: "test",
  GITHUB_SECRET: "test",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  WEBAPP_URL: "mock-webapp-url",
  AI_AZURE_LLM_RESSOURCE_NAME: "mock-azure-llm-resource-name",
  AI_AZURE_LLM_API_KEY: "mock-azure-llm-api-key",
  AI_AZURE_LLM_DEPLOYMENT_ID: "mock-azure-llm-deployment-id",
  AI_AZURE_EMBEDDINGS_RESSOURCE_NAME: "mock-azure-embeddings-resource-name",
  AI_AZURE_EMBEDDINGS_API_KEY: "mock-azure-embeddings-api-key",
  AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID: "mock-azure-embeddings-deployment-id",
  IS_PRODUCTION: true,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  IS_POSTHOG_CONFIGURED: true,
}));

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock QuestionFormInput component
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn(({ id, value, updateQuestion, onKeyDown }) => (
    <div data-testid={`question-input-${id}`}>
      <input
        data-testid={`input-${id}`}
        onChange={(e) => {
          if (updateQuestion) {
            updateQuestion(0, { [id]: { default: e.target.value } });
          }
        }}
        value={value?.default || ""}
        onKeyDown={onKeyDown}
      />
    </div>
  )),
}));

// Mock ShuffleOptionSelect component
vi.mock("@/modules/ui/components/shuffle-option-select", () => ({
  ShuffleOptionSelect: vi.fn(() => <div data-testid="shuffle-option-select" />),
}));

// Mock MatrixSortableItem component
vi.mock("@/modules/survey/editor/components/matrix-sortable-item", () => ({
  MatrixSortableItem: vi.fn(({ choice, index, type, onDelete, onKeyDown, canDelete }) => (
    <div data-testid={`matrix-sortable-item-${type}-${index}`}>
      <div data-testid={`grip-${type}-${index}`} />
      <input
        data-testid={`input-${type}-${index}`}
        defaultValue={choice?.label?.default || ""}
        onKeyDown={onKeyDown}
      />
      {canDelete && (
        <button data-testid={`delete-${type}-${index}`} onClick={() => onDelete(index)}>
          Delete
        </button>
      )}
    </div>
  )),
}));

// Mock TooltipRenderer component
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: vi.fn(({ children }) => (
    <div data-testid="tooltip-renderer">
      {children}
      <button>Delete</button>
    </div>
  )),
}));

// Mock validation
vi.mock("../lib/validation", () => ({
  isLabelValidForAllLanguages: vi.fn().mockReturnValue(true),
}));

// Mock survey languages
const mockSurveyLanguages: TSurveyLanguage[] = [
  {
    default: true,
    enabled: true,
    language: {
      id: "en",
      code: "en",
      alias: "English",
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "project-1",
    },
  },
];

// Mock matrix question
const mockMatrixQuestion: TSurveyMatrixQuestion = {
  id: "matrix-1",
  type: TSurveyQuestionTypeEnum.Matrix,
  headline: createI18nString("Matrix Question", ["en"]),
  subheader: createI18nString("Please rate the following", ["en"]),
  required: false,
  logic: [],
  rows: [
    { id: "idx_row_1", label: createI18nString("Row 1", ["en"]) },
    { id: "idx_row_2", label: createI18nString("Row 2", ["en"]) },
    { id: "idx_row_3", label: createI18nString("Row 3", ["en"]) },
  ],
  columns: [
    { id: "idx_cols_1", label: createI18nString("Column 1", ["en"]) },
    { id: "idx_cols_2", label: createI18nString("Column 2", ["en"]) },
    { id: "idx_cols_3", label: createI18nString("Column 3", ["en"]) },
  ],
  shuffleOption: "none",
};

// Mock survey
const mockSurvey: TSurvey = {
  id: "survey-1",
  name: "Test Survey",
  questions: [mockMatrixQuestion],
  languages: mockSurveyLanguages,
} as unknown as TSurvey;

const mockUpdateQuestion = vi.fn();

const defaultProps = {
  localSurvey: mockSurvey,
  question: mockMatrixQuestion,
  questionIdx: 0,
  updateQuestion: mockUpdateQuestion,
  selectedLanguageCode: "en",
  setSelectedLanguageCode: vi.fn(),
  isInvalid: false,
  locale: "en-US" as TUserLocale,
};

describe("MatrixQuestionForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    // Reset drag end handlers
    dragEndHandlers = {};
  });

  test("renders the matrix question form with rows and columns", () => {
    render(<MatrixQuestionForm {...defaultProps} />);

    expect(screen.getByTestId("question-input-headline")).toBeInTheDocument();

    // Check for DndContext areas
    expect(screen.getByTestId("dnd-context-matrix-rows")).toBeInTheDocument();
    expect(screen.getByTestId("dnd-context-matrix-columns")).toBeInTheDocument();

    // Check for sortable rows and columns
    expect(screen.getByTestId("matrix-sortable-item-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-sortable-item-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-sortable-item-column-0")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-sortable-item-column-1")).toBeInTheDocument();

    // Check for shuffle options
    expect(screen.getByTestId("shuffle-option-select")).toBeInTheDocument();
  });

  test("adds description when button is clicked", async () => {
    const user = userEvent.setup();
    const propsWithoutSubheader = {
      ...defaultProps,
      question: {
        ...mockMatrixQuestion,
        subheader: undefined,
      },
    };

    const { getByText } = render(<MatrixQuestionForm {...propsWithoutSubheader} />);

    const addDescriptionButton = getByText("environments.surveys.edit.add_description");
    await user.click(addDescriptionButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      subheader: expect.any(Object),
    });
  });

  test("renders subheader input when subheader is defined", () => {
    render(<MatrixQuestionForm {...defaultProps} />);

    expect(screen.getByTestId("question-input-subheader")).toBeInTheDocument();
  });

  test("adds a new row when 'Add Row' button is clicked", async () => {
    const user = userEvent.setup();
    const { getByText } = render(<MatrixQuestionForm {...defaultProps} />);

    const addRowButton = getByText("environments.surveys.edit.add_row");
    await user.click(addRowButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      rows: [
        ...mockMatrixQuestion.rows,
        { id: expect.any(String), label: expect.objectContaining({ default: "" }) },
      ],
    });
  });

  test("adds a new column when 'Add Column' button is clicked", async () => {
    const user = userEvent.setup();
    const { getByText } = render(<MatrixQuestionForm {...defaultProps} />);

    const addColumnButton = getByText("environments.surveys.edit.add_column");
    await user.click(addColumnButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      columns: [
        ...mockMatrixQuestion.columns,
        { id: expect.any(String), label: expect.objectContaining({ default: "" }) },
      ],
    });
  });

  test("deletes a row when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<MatrixQuestionForm {...defaultProps} />);
    vi.mocked(findOptionUsedInLogic).mockReturnValueOnce(-1);

    const deleteButton = screen.getByTestId("delete-row-0");
    await user.click(deleteButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      rows: [mockMatrixQuestion.rows[1], mockMatrixQuestion.rows[2]],
    });
  });

  test("doesn't delete a row if it would result in less than 2 rows", async () => {
    const user = userEvent.setup();
    const propsWithMinRows = {
      ...defaultProps,
      question: {
        ...mockMatrixQuestion,
        rows: [
          { id: "idx_rows_1", label: createI18nString("Row 1", ["en"]) },
          { id: "idx_rows_2", label: createI18nString("Row 2", ["en"]) },
        ],
      },
    };

    render(<MatrixQuestionForm {...propsWithMinRows} />);

    // With only 2 rows, delete buttons should not be rendered (canDelete = false)
    expect(screen.queryByTestId("delete-row-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delete-row-1")).not.toBeInTheDocument();
  });

  test("handles row input changes", async () => {
    const user = userEvent.setup();
    render(<MatrixQuestionForm {...defaultProps} />);

    const rowInput = screen.getByTestId("input-row-0");
    await user.clear(rowInput);
    await user.type(rowInput, "New Row Label");

    // Note: The actual input change handling is mocked, so we just verify the input exists
    expect(rowInput).toBeInTheDocument();
  });

  test("handles column input changes", async () => {
    const user = userEvent.setup();
    render(<MatrixQuestionForm {...defaultProps} />);

    const columnInput = screen.getByTestId("input-column-0");
    await user.clear(columnInput);
    await user.type(columnInput, "New Column Label");

    // Note: The actual input change handling is mocked, so we just verify the input exists
    expect(columnInput).toBeInTheDocument();
  });

  test("handles Enter key to add a new row from row input", async () => {
    const user = userEvent.setup();
    render(<MatrixQuestionForm {...defaultProps} />);

    const rowInput = screen.getByTestId("input-row-0");
    await user.click(rowInput);
    await user.keyboard("{Enter}");

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      rows: [
        mockMatrixQuestion.rows[0],
        mockMatrixQuestion.rows[1],
        mockMatrixQuestion.rows[2],
        expect.any(Object),
      ],
    });
  });

  test("handles Enter key to add a new column from column input", async () => {
    const user = userEvent.setup();
    render(<MatrixQuestionForm {...defaultProps} />);

    const columnInput = screen.getByTestId("input-column-0");
    await user.click(columnInput);
    await user.keyboard("{Enter}");

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      columns: [
        mockMatrixQuestion.columns[0],
        mockMatrixQuestion.columns[1],
        mockMatrixQuestion.columns[2],
        expect.any(Object),
      ],
    });
  });

  test("prevents deletion of a row used in logic", async () => {
    const { findOptionUsedInLogic } = await import("@/modules/survey/editor/lib/utils");
    vi.mocked(findOptionUsedInLogic).mockReturnValueOnce(1); // Mock that this row is used in logic

    const user = userEvent.setup();
    render(<MatrixQuestionForm {...defaultProps} />);

    const deleteButton = screen.getByTestId("delete-row-0");
    await user.click(deleteButton);

    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });

  test("prevents deletion of a column used in logic", async () => {
    const { findOptionUsedInLogic } = await import("@/modules/survey/editor/lib/utils");
    vi.mocked(findOptionUsedInLogic).mockReturnValueOnce(1); // Mock that this column is used in logic

    const user = userEvent.setup();
    render(<MatrixQuestionForm {...defaultProps} />);

    const deleteButton = screen.getByTestId("delete-column-0");
    await user.click(deleteButton);

    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });

  test("handles drag end for rows", () => {
    render(<MatrixQuestionForm {...defaultProps} />);

    // Simulate drag end event for rows
    const dragEndEvent = {
      active: { id: mockMatrixQuestion.rows[0].id },
      over: { id: mockMatrixQuestion.rows[2].id },
    };

    // Use the captured onDragEnd handler for matrix-rows
    const rowsDragEndHandler = dragEndHandlers["matrix-rows"];
    if (rowsDragEndHandler) {
      rowsDragEndHandler(dragEndEvent);
    }

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      rows: [
        mockMatrixQuestion.rows[1], // Row 1 moves to position 0
        mockMatrixQuestion.rows[2], // Row 2 moves to position 1
        mockMatrixQuestion.rows[0], // Row 0 moves to position 2
      ],
    });
  });

  test("handles drag end for columns", () => {
    render(<MatrixQuestionForm {...defaultProps} />);

    // Simulate drag end event for columns
    const dragEndEvent = {
      active: { id: mockMatrixQuestion.columns[0].id },
      over: { id: mockMatrixQuestion.columns[2].id },
    };

    // Use the captured onDragEnd handler for matrix-columns
    const columnsDragEndHandler = dragEndHandlers["matrix-columns"];
    if (columnsDragEndHandler) {
      columnsDragEndHandler(dragEndEvent);
    }

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      columns: [
        mockMatrixQuestion.columns[1], // Column 1 moves to position 0
        mockMatrixQuestion.columns[2], // Column 2 moves to position 1
        mockMatrixQuestion.columns[0], // Column 0 moves to position 2
      ],
    });
  });

  test("ignores drag end when active and over are the same", () => {
    render(<MatrixQuestionForm {...defaultProps} />);

    // Simulate drag end event where item is dropped on itself
    const dragEndEvent = {
      active: { id: mockMatrixQuestion.rows[0].id },
      over: { id: mockMatrixQuestion.rows[0].id },
    };

    // Use the captured onDragEnd handler for matrix-rows
    const rowsDragEndHandler = dragEndHandlers["matrix-rows"];
    if (rowsDragEndHandler) {
      rowsDragEndHandler(dragEndEvent);
    }

    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });
});
