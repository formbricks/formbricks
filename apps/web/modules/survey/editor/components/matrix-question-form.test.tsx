import { createI18nString } from "@/lib/i18n/utils";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { MatrixQuestionForm } from "./matrix-question-form";

// Mock cuid2 to track CUID generation
const mockCuids = ["cuid1", "cuid2", "cuid3", "cuid4", "cuid5", "cuid6"];
let cuidIndex = 0;

vi.mock("@paralleldrive/cuid2", () => ({
  default: {
    createId: vi.fn(() => mockCuids[cuidIndex++]),
  },
}));

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
  QuestionFormInput: vi.fn(({ id, updateMatrixLabel, value, updateQuestion, onKeyDown }) => (
    <div data-testid={`question-input-${id}`}>
      <input
        data-testid={`input-${id}`}
        onChange={(e) => {
          if (updateMatrixLabel) {
            const type = id.startsWith("row") ? "row" : "column";
            const index = parseInt(id.split("-")[1]);
            updateMatrixLabel(index, type, { default: e.target.value });
          } else if (updateQuestion) {
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
    createI18nString("Row 1", ["en"]),
    createI18nString("Row 2", ["en"]),
    createI18nString("Row 3", ["en"]),
  ],
  columns: [
    createI18nString("Column 1", ["en"]),
    createI18nString("Column 2", ["en"]),
    createI18nString("Column 3", ["en"]),
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
  });

  test("renders the matrix question form with rows and columns", () => {
    render(<MatrixQuestionForm {...defaultProps} />);

    expect(screen.getByTestId("question-input-headline")).toBeInTheDocument();

    // Check for rows and columns
    expect(screen.getByTestId("question-input-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("question-input-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("question-input-column-0")).toBeInTheDocument();
    expect(screen.getByTestId("question-input-column-1")).toBeInTheDocument();

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
        mockMatrixQuestion.rows[0],
        mockMatrixQuestion.rows[1],
        mockMatrixQuestion.rows[2],
        { default: "" },
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
        mockMatrixQuestion.columns[0],
        mockMatrixQuestion.columns[1],
        mockMatrixQuestion.columns[2],
        { default: "" },
      ],
    });
  });

  test("deletes a row when delete button is clicked", async () => {
    const user = userEvent.setup();
    const { findAllByTestId } = render(<MatrixQuestionForm {...defaultProps} />);
    vi.mocked(findOptionUsedInLogic).mockReturnValueOnce(-1);

    const deleteButtons = await findAllByTestId("tooltip-renderer");
    // First delete button is for the first column
    await user.click(deleteButtons[0].querySelector("button") as HTMLButtonElement);

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
        rows: [createI18nString("Row 1", ["en"]), createI18nString("Row 2", ["en"])],
      },
    };

    const { findAllByTestId } = render(<MatrixQuestionForm {...propsWithMinRows} />);

    // Try to delete rows until there are only 2 left
    const deleteButtons = await findAllByTestId("tooltip-renderer");
    await user.click(deleteButtons[0].querySelector("button") as HTMLButtonElement);

    // Try to delete another row, which should fail
    vi.mocked(mockUpdateQuestion).mockClear();
    await user.click(deleteButtons[1].querySelector("button") as HTMLButtonElement);

    // The mockUpdateQuestion should not be called again
    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });

  test("handles row input changes", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<MatrixQuestionForm {...defaultProps} />);

    const rowInput = getByTestId("input-row-0");
    await user.clear(rowInput);
    await user.type(rowInput, "New Row Label");

    expect(mockUpdateQuestion).toHaveBeenCalled();
  });

  test("handles column input changes", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<MatrixQuestionForm {...defaultProps} />);

    const columnInput = getByTestId("input-column-0");
    await user.clear(columnInput);
    await user.type(columnInput, "New Column Label");

    expect(mockUpdateQuestion).toHaveBeenCalled();
  });

  test("handles Enter key to add a new row from row input", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<MatrixQuestionForm {...defaultProps} />);

    const rowInput = getByTestId("input-row-0");
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
    const { getByTestId } = render(<MatrixQuestionForm {...defaultProps} />);

    const columnInput = getByTestId("input-column-0");
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
    const { findAllByTestId } = render(<MatrixQuestionForm {...defaultProps} />);

    const deleteButtons = await findAllByTestId("tooltip-renderer");
    await user.click(deleteButtons[0].querySelector("button") as HTMLButtonElement);

    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });

  test("prevents deletion of a column used in logic", async () => {
    const { findOptionUsedInLogic } = await import("@/modules/survey/editor/lib/utils");
    vi.mocked(findOptionUsedInLogic).mockReturnValueOnce(1); // Mock that this column is used in logic

    const user = userEvent.setup();
    const { findAllByTestId } = render(<MatrixQuestionForm {...defaultProps} />);

    // Column delete buttons are after row delete buttons
    const deleteButtons = await findAllByTestId("tooltip-renderer");
    // Click the first column delete button (index 2)
    await user.click(deleteButtons[2].querySelector("button") as HTMLButtonElement);

    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });

  // CUID functionality tests
  describe("CUID Management", () => {
    beforeEach(() => {
      // Reset CUID index before each test
      cuidIndex = 0;
    });

    test("generates stable CUIDs for rows and columns on initial render", () => {
      const { rerender } = render(<MatrixQuestionForm {...defaultProps} />);

      // Check that CUIDs are generated for initial items
      expect(cuidIndex).toBe(6); // 3 rows + 3 columns

      // Rerender with the same props - no new CUIDs should be generated
      rerender(<MatrixQuestionForm {...defaultProps} />);
      expect(cuidIndex).toBe(6); // Should remain the same
    });

    test("maintains stable CUIDs across rerenders", () => {
      const TestComponent = ({ question }: { question: TSurveyMatrixQuestion }) => {
        return <MatrixQuestionForm {...defaultProps} question={question} />;
      };

      const { rerender } = render(<TestComponent question={mockMatrixQuestion} />);

      // Check initial CUID count
      expect(cuidIndex).toBe(6); // 3 rows + 3 columns

      // Rerender multiple times
      rerender(<TestComponent question={mockMatrixQuestion} />);
      rerender(<TestComponent question={mockMatrixQuestion} />);
      rerender(<TestComponent question={mockMatrixQuestion} />);

      // CUIDs should remain stable
      expect(cuidIndex).toBe(6); // Should not increase
    });

    test("generates new CUIDs only when rows are added", async () => {
      const user = userEvent.setup();

      // Create a test component that can update its props
      const TestComponent = () => {
        const [question, setQuestion] = React.useState(mockMatrixQuestion);

        const handleUpdateQuestion = (_: number, updates: Partial<TSurveyMatrixQuestion>) => {
          setQuestion((prev) => ({ ...prev, ...updates }));
        };

        return (
          <MatrixQuestionForm {...defaultProps} question={question} updateQuestion={handleUpdateQuestion} />
        );
      };

      const { getByText } = render(<TestComponent />);

      // Initial render should generate 6 CUIDs (3 rows + 3 columns)
      expect(cuidIndex).toBe(6);

      // Add a new row
      const addRowButton = getByText("environments.surveys.edit.add_row");
      await user.click(addRowButton);

      // Should generate 1 new CUID for the new row
      expect(cuidIndex).toBe(7);
    });

    test("generates new CUIDs only when columns are added", async () => {
      const user = userEvent.setup();

      // Create a test component that can update its props
      const TestComponent = () => {
        const [question, setQuestion] = React.useState(mockMatrixQuestion);

        const handleUpdateQuestion = (_: number, updates: Partial<TSurveyMatrixQuestion>) => {
          setQuestion((prev) => ({ ...prev, ...updates }));
        };

        return (
          <MatrixQuestionForm {...defaultProps} question={question} updateQuestion={handleUpdateQuestion} />
        );
      };

      const { getByText } = render(<TestComponent />);

      // Initial render should generate 6 CUIDs (3 rows + 3 columns)
      expect(cuidIndex).toBe(6);

      // Add a new column
      const addColumnButton = getByText("environments.surveys.edit.add_column");
      await user.click(addColumnButton);

      // Should generate 1 new CUID for the new column
      expect(cuidIndex).toBe(7);
    });

    test("maintains CUID stability when items are deleted", async () => {
      const user = userEvent.setup();
      const { findAllByTestId, rerender } = render(<MatrixQuestionForm {...defaultProps} />);

      // Mock that no items are used in logic
      vi.mocked(findOptionUsedInLogic).mockReturnValue(-1);

      // Initial render: 6 CUIDs generated
      expect(cuidIndex).toBe(6);

      // Delete a row
      const deleteButtons = await findAllByTestId("tooltip-renderer");
      await user.click(deleteButtons[0].querySelector("button") as HTMLButtonElement);

      // No new CUIDs should be generated for deletion
      expect(cuidIndex).toBe(6);

      // Rerender should not generate new CUIDs
      rerender(<MatrixQuestionForm {...defaultProps} />);
      expect(cuidIndex).toBe(6);
    });

    test("handles mixed operations maintaining CUID stability", async () => {
      const user = userEvent.setup();

      // Create a test component that can update its props
      const TestComponent = () => {
        const [question, setQuestion] = React.useState(mockMatrixQuestion);

        const handleUpdateQuestion = (_: number, updates: Partial<TSurveyMatrixQuestion>) => {
          setQuestion((prev) => ({ ...prev, ...updates }));
        };

        return (
          <MatrixQuestionForm {...defaultProps} question={question} updateQuestion={handleUpdateQuestion} />
        );
      };

      const { getByText, findAllByTestId } = render(<TestComponent />);

      // Mock that no items are used in logic
      vi.mocked(findOptionUsedInLogic).mockReturnValue(-1);

      // Initial: 6 CUIDs
      expect(cuidIndex).toBe(6);

      // Add a row: +1 CUID
      const addRowButton = getByText("environments.surveys.edit.add_row");
      await user.click(addRowButton);
      expect(cuidIndex).toBe(7);

      // Add a column: +1 CUID
      const addColumnButton = getByText("environments.surveys.edit.add_column");
      await user.click(addColumnButton);
      expect(cuidIndex).toBe(8);

      // Delete a row: no new CUIDs
      const deleteButtons = await findAllByTestId("tooltip-renderer");
      await user.click(deleteButtons[0].querySelector("button") as HTMLButtonElement);
      expect(cuidIndex).toBe(8);

      // Delete a column: no new CUIDs
      const updatedDeleteButtons = await findAllByTestId("tooltip-renderer");
      await user.click(updatedDeleteButtons[2].querySelector("button") as HTMLButtonElement);
      expect(cuidIndex).toBe(8);
    });

    test("CUID arrays are properly maintained when items are deleted in order", async () => {
      const user = userEvent.setup();
      const propsWithManyRows = {
        ...defaultProps,
        question: {
          ...mockMatrixQuestion,
          rows: [
            createI18nString("Row 1", ["en"]),
            createI18nString("Row 2", ["en"]),
            createI18nString("Row 3", ["en"]),
            createI18nString("Row 4", ["en"]),
          ],
        },
      };

      const { findAllByTestId } = render(<MatrixQuestionForm {...propsWithManyRows} />);

      // Mock that no items are used in logic
      vi.mocked(findOptionUsedInLogic).mockReturnValue(-1);

      // Initial: 7 CUIDs (4 rows + 3 columns)
      expect(cuidIndex).toBe(7);

      // Delete first row
      const deleteButtons = await findAllByTestId("tooltip-renderer");
      await user.click(deleteButtons[0].querySelector("button") as HTMLButtonElement);

      // Verify the correct row was deleted (should be Row 2, Row 3, Row 4 remaining)
      expect(mockUpdateQuestion).toHaveBeenLastCalledWith(0, {
        rows: [
          propsWithManyRows.question.rows[1],
          propsWithManyRows.question.rows[2],
          propsWithManyRows.question.rows[3],
        ],
      });

      // No new CUIDs should be generated
      expect(cuidIndex).toBe(7);
    });

    test("CUID generation is consistent across component instances", () => {
      // Reset CUID index
      cuidIndex = 0;

      // Render first instance
      const { unmount } = render(<MatrixQuestionForm {...defaultProps} />);
      expect(cuidIndex).toBe(6);

      // Unmount and render second instance
      unmount();
      render(<MatrixQuestionForm {...defaultProps} />);

      // Should generate 6 more CUIDs for the new instance
      expect(cuidIndex).toBe(12);
    });
  });
});
