import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuotaConditions } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  createQuotaConditionsCallbacks,
  createQuotaConditionsConfig,
  quotaConditionsToGeneric,
} from "../lib/conditions-config";
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

// Mock the conditions config functions
vi.mock("../lib/conditions-config", () => ({
  quotaConditionsToGeneric: vi.fn((conditions) => ({
    connector: conditions.connector,
    criteria: conditions.criteria.map((criterion: any) => ({
      ...criterion,
      type: "generic",
    })),
  })),
  createQuotaConditionsConfig: vi.fn(() => ({
    getLeftOperandOptions: vi.fn(),
    getOperatorOptions: vi.fn(),
    getDefaultOperator: vi.fn(() => "equals"),
    formatLeftOperandValue: vi.fn(),
  })),
  genericConditionsToQuota: vi.fn((genericConditions) => ({
    connector: genericConditions.connector,
    criteria: genericConditions.criteria.map((criterion: any) => ({
      ...criterion,
      leftOperand: criterion.leftOperand || { type: "question", value: "q1" },
      operator: criterion.operator || "equals",
    })),
  })),
  createQuotaConditionsCallbacks: vi.fn((onChange) => ({
    onAddConditionBelow: vi.fn(),
    onRemoveCondition: vi.fn(),
    onDuplicateCondition: vi.fn(),
    onUpdateCondition: vi.fn((id, updates) => {
      onChange({
        connector: "and",
        criteria: [{ id, ...updates }],
      });
    }),
    onToggleGroupConnector: vi.fn(),
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

  const mockConditions: TSurveyQuotaConditions = {
    connector: "and",
    criteria: [
      {
        id: "condition1",
        leftOperand: { type: "question", value: "q1" },
        operator: "equals",
        rightOperand: { type: "static", value: "test" },
      },
    ],
  };

  const mockEmptyConditions: TSurveyQuotaConditions = {
    connector: "and",
    criteria: [],
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

  test("passes converted conditions to editor", () => {
    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    const conditionsData = screen.getByTestId("conditions-data");
    expect(conditionsData).toBeInTheDocument();

    // Verify that quotaConditionsToGeneric was called
    expect(vi.mocked(quotaConditionsToGeneric)).toHaveBeenCalledWith(mockConditions, mockSurvey);
  });

  test("creates configuration for conditions editor", () => {
    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    const configData = screen.getByTestId("config-data");
    expect(configData).toBeInTheDocument();

    // Verify that createQuotaConditionsConfig was called
    expect(vi.mocked(createQuotaConditionsConfig)).toHaveBeenCalledWith(mockSurvey, expect.any(Function));
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

  test("creates callbacks for conditions editor", () => {
    render(<QuotaConditionBuilder survey={mockSurvey} conditions={mockConditions} onChange={mockOnChange} />);

    // Verify that createQuotaConditionsCallbacks was called
    expect(vi.mocked(createQuotaConditionsCallbacks)).toHaveBeenCalled();
  });

  test("handles conditions with different connectors", () => {
    const orConditions: TSurveyQuotaConditions = {
      connector: "or",
      criteria: [
        {
          id: "condition1",
          leftOperand: { type: "question", value: "q1" },
          operator: "contains",
          rightOperand: { type: "static", value: "test" },
        },
      ],
    };

    render(<QuotaConditionBuilder survey={mockSurvey} conditions={orConditions} onChange={mockOnChange} />);

    expect(vi.mocked(quotaConditionsToGeneric)).toHaveBeenCalledWith(orConditions, mockSurvey);
  });

  test("handles multiple criteria", () => {
    const multipleConditions: TSurveyQuotaConditions = {
      connector: "and",
      criteria: [
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

    expect(vi.mocked(quotaConditionsToGeneric)).toHaveBeenCalledWith(multipleConditions, mockSurvey);
  });
});
