import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuotaLogic } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import { QuotaConditionBuilder } from "./quota-condition-builder";

// Mock the ConditionsEditor component
vi.mock("@/modules/ui/components/conditions-editor", () => ({
  ConditionsEditor: ({ conditions, config, callbacks }: any) => (
    <div data-testid="conditions-editor">
      <div data-testid="conditions-data">{JSON.stringify(conditions)}</div>
      <div data-testid="config-data">{JSON.stringify(config)}</div>
      <button
        data-testid="trigger-change"
        onClick={() => callbacks.onUpdateCondition?.("test-id", { operator: "equals" })}>
        Trigger Change
      </button>
    </div>
  ),
}));

// Mock the shared conditions factory
vi.mock("@/modules/survey/editor/lib/shared-conditions-factory", () => ({
  quotaConditionsToGeneric: vi.fn((conditions) => ({
    id: "root",
    connector: conditions.connector,
    conditions: conditions.conditions,
  })),
  genericConditionsToQuota: vi.fn((genericConditions) => ({
    connector: genericConditions.connector,
    conditions: genericConditions.conditions,
  })),
  createSharedConditionsFactory: vi.fn(() => ({
    config: {
      getLeftOperandOptions: vi.fn(),
      getOperatorOptions: vi.fn(),
      getValueProps: vi.fn(),
      getDefaultOperator: vi.fn(() => "equals"),
      formatLeftOperandValue: vi.fn(),
    },
    callbacks: {
      onAddConditionBelow: vi.fn(),
      onRemoveCondition: vi.fn(),
      onDuplicateCondition: vi.fn(),
      onUpdateCondition: vi.fn(),
      onToggleGroupConnector: vi.fn(),
    },
  })),
}));

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock @paralleldrive/cuid2
vi.mock("@paralleldrive/cuid2", () => ({
  createId: () => "test-id-123",
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("QuotaConditionBuilder", () => {
  const mockOnChange = vi.fn();

  const mockSurvey: TSurvey = {
    id: "survey1",
    questions: [
      {
        id: "q1",
        type: "openText",
        headline: { default: "What is your name?" },
        required: false,
        inputType: "text",
      },
      {
        id: "q2",
        type: "multipleChoiceSingle",
        headline: { default: "Choose an option" },
        required: false,
        choices: [
          { id: "choice1", label: { default: "Option 1" } },
          { id: "choice2", label: { default: "Option 2" } },
        ],
      },
    ],
  } as unknown as TSurvey;

  const mockConditions: TSurveyQuotaLogic = {
    connector: "and",
    conditions: [
      {
        id: "condition1",
        leftOperand: { type: "question", value: "q1" },
        operator: "equals",
        rightOperand: { type: "static", value: "test" },
      },
    ],
  };

  const mockEmptyConditions: TSurveyQuotaLogic = {
    connector: "and",
    conditions: [],
  };

  beforeEach(() => {
    mockOnChange.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders conditions editor", () => {
    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    expect(screen.getByTestId("conditions-editor")).toBeInTheDocument();
  });

  test("passes converted conditions to editor", async () => {
    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    const conditionsData = screen.getByTestId("conditions-data");
    expect(conditionsData).toBeInTheDocument();
  });

  test("creates configuration for conditions editor", async () => {
    const { createSharedConditionsFactory } = await vi.importMock(
      "@/modules/survey/editor/lib/shared-conditions-factory"
    );

    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    const configData = screen.getByTestId("config-data");
    expect(configData).toBeInTheDocument();

    // Verify that createSharedConditionsFactory was called
    expect(createSharedConditionsFactory).toHaveBeenCalled();
  });

  test("does not initialize when conditions already exist", () => {
    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    // Should not call onChange for initialization when conditions exist
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  test("does not initialize when survey has no questions", () => {
    const surveyWithoutQuestions = {
      ...mockSurvey,
      questions: [],
    };

    render(
      <QuotaConditionBuilder
        survey={surveyWithoutQuestions}
        conditions={mockEmptyConditions}
        onChange={mockOnChange}
      />
    );

    // Should not call onChange when no questions available
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  test("creates callbacks for conditions editor", async () => {
    const { createSharedConditionsFactory } = await vi.importMock(
      "@/modules/survey/editor/lib/shared-conditions-factory"
    );

    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    // Verify that createSharedConditionsFactory was called which creates both config and callbacks
    expect(createSharedConditionsFactory).toHaveBeenCalled();
  });

  test("handles conditions with different connectors", async () => {
    const { quotaConditionsToGeneric } = await vi.importMock(
      "@/modules/survey/editor/lib/shared-conditions-factory"
    );

    const orConditions: TSurveyQuotaLogic = {
      connector: "or",
      conditions: [
        {
          id: "condition1",
          leftOperand: { type: "question", value: "q1" },
          operator: "contains",
          rightOperand: { type: "static", value: "test" },
        },
      ],
    };

    render(<QuotaConditionBuilder survey={mockSurvey} conditions={orConditions} onChange={mockOnChange} />);

    expect(quotaConditionsToGeneric).toHaveBeenCalledWith(orConditions);
  });

  test("handles multiple criteria", async () => {
    const { quotaConditionsToGeneric } = await vi.importMock(
      "@/modules/survey/editor/lib/shared-conditions-factory"
    );

    const multipleConditions: TSurveyQuotaLogic = {
      connector: "and",
      conditions: [
        {
          id: "condition1",
          leftOperand: { type: "question", value: "q1" },
          operator: "equals",
          rightOperand: { type: "static", value: "test1" },
        },
        {
          id: "condition2",
          leftOperand: { type: "question", value: "q2" },
          operator: "contains",
          rightOperand: { type: "static", value: "test2" },
        },
      ],
    };

    render(
      <QuotaConditionBuilder survey={mockSurvey} conditions={multipleConditions} onChange={mockOnChange} />
    );

    expect(screen.getByTestId("conditions-editor")).toBeInTheDocument();

    expect(quotaConditionsToGeneric).toHaveBeenCalledWith(multipleConditions);
  });
});
