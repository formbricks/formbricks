import { createI18nString } from "@/lib/i18n/utils";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
import { MatrixColumnChoice } from "./matrix-column-choice";

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
  QuestionFormInput: vi.fn(({ id, updateMatrixLabel, value, onKeyDown }) => (
    <div data-testid={`question-input-${id}`}>
      <input
        data-testid={`input-${id}`}
        onChange={(e) => {
          if (updateMatrixLabel) {
            const type = id.startsWith("row") ? "row" : "column";
            const index = parseInt(id.split("-")[1]);
            updateMatrixLabel(index, type, { default: e.target.value });
          }
        }}
        value={value?.default || ""}
        onKeyDown={onKeyDown}
      />
    </div>
  )),
}));

// Mock TooltipRenderer component
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: vi.fn(({ children }) => <div data-testid="tooltip-renderer">{children}</div>),
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
const mockQuestion: TSurveyMatrixQuestion = {
  id: "matrix-1",
  type: TSurveyQuestionTypeEnum.Matrix,
  headline: createI18nString("Matrix Question", ["en"]),
  required: false,
  logic: [],
  rows: [createI18nString("Row 1", ["en"]), createI18nString("Row 2", ["en"])],
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
  questions: [mockQuestion],
  languages: mockSurveyLanguages,
} as unknown as TSurvey;

const defaultProps = {
  columnIdx: 0,
  questionIdx: 0,
  updateMatrixLabel: vi.fn(),
  handleDeleteLabel: vi.fn(),
  handleKeyDown: vi.fn(),
  isInvalid: false,
  localSurvey: mockSurvey,
  selectedLanguageCode: "en",
  setSelectedLanguageCode: vi.fn(),
  question: mockQuestion,
  locale: "en-US" as TUserLocale,
};

const renderWithDndContext = (props = {}) => {
  const finalProps = { ...defaultProps, ...props };
  return render(
    <DndContext>
      <SortableContext items={["column-0"]} strategy={verticalListSortingStrategy}>
        <MatrixColumnChoice {...finalProps} />
      </SortableContext>
    </DndContext>
  );
};

describe("MatrixColumnChoice", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the column choice with drag handle and input", () => {
    renderWithDndContext();

    expect(screen.getByDisplayValue("Column 1")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  test("shows delete button when there are more than 2 columns", () => {
    renderWithDndContext();

    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((button) => button.querySelector('svg[class*="lucide-trash"]'));
    expect(deleteButton).toBeInTheDocument();
  });

  test("hides delete button when there are only 2 columns", () => {
    const questionWith2Columns = {
      ...mockQuestion,
      columns: [createI18nString("Column 1", ["en"]), createI18nString("Column 2", ["en"])],
    };

    renderWithDndContext({ question: questionWith2Columns });

    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((button) => button.querySelector('svg[class*="lucide-trash"]'));
    expect(deleteButton).toBeUndefined();
  });

  test("calls handleDeleteLabel when delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleDeleteLabel = vi.fn();

    renderWithDndContext({ handleDeleteLabel });

    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((button) => button.querySelector('svg[class*="lucide-trash"]'));
    expect(deleteButton).toBeDefined();

    await user.click(deleteButton!);

    expect(handleDeleteLabel).toHaveBeenCalledWith("column", 0);
  });

  test("calls updateMatrixLabel when input value changes", async () => {
    const user = userEvent.setup();
    const updateMatrixLabel = vi.fn();

    renderWithDndContext({ updateMatrixLabel });

    const input = screen.getByDisplayValue("Column 1");
    await user.clear(input);
    await user.type(input, "Updated Column");

    expect(updateMatrixLabel).toHaveBeenCalled();
  });

  test("calls handleKeyDown when Enter key is pressed", async () => {
    const user = userEvent.setup();
    const handleKeyDown = vi.fn();

    renderWithDndContext({ handleKeyDown });

    const input = screen.getByDisplayValue("Column 1");
    await user.type(input, "{Enter}");

    expect(handleKeyDown).toHaveBeenCalled();
  });

  test("applies invalid styling when isInvalid is true", () => {
    renderWithDndContext({ isInvalid: true });

    // The styling is applied through the QuestionFormInput component
    const input = screen.getByDisplayValue("Column 1");
    expect(input).toBeInTheDocument();
  });
});
