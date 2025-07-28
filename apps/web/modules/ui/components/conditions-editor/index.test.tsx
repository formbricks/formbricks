import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConditionsEditor } from "./index";
import { TConditionsEditorCallbacks, TConditionsEditorConfig, TGenericConditionGroup } from "./types";

// Mock dependencies to isolate the component
vi.mock("@/modules/ui/components/input-combo-box", () => ({
  InputCombobox: ({ value, onChangeValue, id, options, groupedOptions }) => {
    const allOptions = [...(options || []), ...(groupedOptions?.flatMap((g) => g.options) || [])];

    const handleChange = (e) => {
      const selectedOption = allOptions.find((o) => o.value === e.target.value);
      onChangeValue(e.target.value, selectedOption);
    };

    return <input data-testid={id} value={value as string} onChange={handleChange} />;
  },
}));

vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled, icon }) => (
    <button data-testid="dropdown-item" onClick={onClick} disabled={disabled}>
      {icon}
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, onValueChange, value }) => (
    <select data-testid="connector-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: () => <div />,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [vi.fn()],
}));

vi.mock("lucide-react", () => ({
  PlusIcon: () => <div data-testid="plus-icon" />,
  TrashIcon: () => <div data-testid="trash-icon" />,
  CopyIcon: () => <div data-testid="copy-icon" />,
  WorkflowIcon: () => <div data-testid="workflow-icon" />,
  EllipsisVerticalIcon: () => <div data-testid="ellipsis-icon" />,
}));

vi.mock("@tolgee/react", async () => {
  return {
    useTranslate: () => ({
      t: (key) => key,
    }),
  };
});

// Mock data and callbacks
const mockCallbacks: TConditionsEditorCallbacks = {
  onAddConditionBelow: vi.fn(),
  onRemoveCondition: vi.fn(),
  onDuplicateCondition: vi.fn(),
  onCreateGroup: vi.fn(),
  onUpdateCondition: vi.fn(),
  onToggleGroupConnector: vi.fn(),
};

const mockConfig: TConditionsEditorConfig = {
  getLeftOperandOptions: vi.fn(() => [
    {
      label: "Group 1",
      value: "g1",
      options: [
        { label: "Option 1", value: "opt1", meta: { type: "question" } },
        { label: "Option 2", value: "opt2", meta: { type: "question" } },
      ],
    },
  ]),
  getOperatorOptions: vi.fn(() => [
    { label: "Equals", value: "equals" },
    { label: "Not Equals", value: "notEquals" },
  ]),
  getValueProps: vi.fn(() => ({ show: true, options: [], showInput: true, inputType: "text" })),
  getDefaultOperator: vi.fn(() => "equals"),
  formatLeftOperandValue: vi.fn((c) => c.leftOperand.value),
};

const singleCondition: TGenericConditionGroup = {
  id: "root",
  connector: "and",
  conditions: [
    {
      id: "cond1",
      leftOperand: { value: "opt1", type: "question" },
      operator: "equals",
      rightOperand: { value: "value1", type: "static" },
    },
  ],
};

const multipleConditions: TGenericConditionGroup = {
  id: "root",
  connector: "and",
  conditions: [
    {
      id: "cond1",
      leftOperand: { value: "opt1", type: "question" },
      operator: "equals",
      rightOperand: { value: "value1", type: "static" },
    },
    {
      id: "cond2",
      leftOperand: { value: "opt2", type: "question" },
      operator: "notEquals",
      rightOperand: { value: "value2", type: "static" },
    },
  ],
};

const nestedConditions: TGenericConditionGroup = {
  id: "root",
  connector: "and",
  conditions: [
    {
      id: "cond1",
      leftOperand: { value: "opt1", type: "question" },
      operator: "equals",
      rightOperand: { value: "value1", type: "static" },
    },
    {
      id: "group1",
      connector: "or",
      conditions: [
        {
          id: "cond2",
          leftOperand: { value: "opt2", type: "question" },
          operator: "notEquals",
          rightOperand: { value: "value2", type: "static" },
        },
      ],
    },
  ],
};

describe("ConditionsEditor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders a single condition with a 'When' prefix", () => {
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    expect(screen.getByText("When")).toBeInTheDocument();
    expect(screen.queryByTestId("connector-select")).not.toBeInTheDocument();
  });

  test("renders multiple conditions with a 'When' connector", () => {
    render(
      <ConditionsEditor conditions={multipleConditions} config={mockConfig} callbacks={mockCallbacks} />
    );
    expect(screen.getByText(/When/)).toBeInTheDocument();
    expect(screen.getByTestId("connector-select")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  test("renders nested conditions correctly", () => {
    render(<ConditionsEditor conditions={nestedConditions} config={mockConfig} callbacks={mockCallbacks} />);
    expect(screen.getAllByText("When")).toHaveLength(2);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  test("calls onUpdateCondition when the left operand changes", () => {
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    const leftOperandInput = screen.getByTestId("condition-0-0-conditionValue");
    fireEvent.change(leftOperandInput, { target: { value: "opt2" } });
    expect(mockCallbacks.onUpdateCondition).toHaveBeenCalledWith(
      "cond1",
      expect.objectContaining({
        leftOperand: { value: "opt2", type: "question", meta: { type: "question" } },
        operator: "equals",
        rightOperand: undefined,
      })
    );
  });

  test("calls onUpdateCondition when the operator changes", () => {
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    const operatorInput = screen.getByTestId("condition-0-0-conditionOperator");
    fireEvent.change(operatorInput, { target: { value: "notEquals" } });
    expect(mockCallbacks.onUpdateCondition).toHaveBeenCalledWith("cond1", {
      operator: "notEquals",
      rightOperand: undefined,
    });
  });

  test("calls onUpdateCondition when the right operand changes", () => {
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    const rightOperandInput = screen.getByTestId("condition-0-0-conditionMatchValue");
    fireEvent.change(rightOperandInput, { target: { value: "new-value" } });
    expect(mockCallbacks.onUpdateCondition).toHaveBeenCalledWith("cond1", {
      rightOperand: { value: "new-value", type: "static" },
    });
  });

  test("calls onAddConditionBelow from the dropdown menu", async () => {
    const user = userEvent.setup();
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    const addConditionButton = screen.getByText("environments.surveys.edit.add_condition_below");
    await user.click(addConditionButton);
    expect(mockCallbacks.onAddConditionBelow).toHaveBeenCalledWith("cond1");
  });

  test("calls onRemoveCondition from the dropdown menu", async () => {
    const user = userEvent.setup();
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    const removeButton = screen.getByText("common.remove");
    await user.click(removeButton);
    expect(mockCallbacks.onRemoveCondition).toHaveBeenCalledWith("cond1");
  });

  test("calls onDuplicateCondition from the dropdown menu", async () => {
    const user = userEvent.setup();
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    const duplicateButton = screen.getByText("common.duplicate");
    await user.click(duplicateButton);
    expect(mockCallbacks.onDuplicateCondition).toHaveBeenCalledWith("cond1");
  });

  test("calls onCreateGroup from the dropdown menu", async () => {
    const user = userEvent.setup();
    render(<ConditionsEditor conditions={singleCondition} config={mockConfig} callbacks={mockCallbacks} />);
    const createGroupButton = screen.getByText("environments.surveys.edit.create_group");
    await user.click(createGroupButton);
    expect(mockCallbacks.onCreateGroup).toHaveBeenCalledWith("cond1");
  });

  test("calls onToggleGroupConnector when the connector is changed", async () => {
    const user = userEvent.setup();
    render(
      <ConditionsEditor conditions={multipleConditions} config={mockConfig} callbacks={mockCallbacks} />
    );
    const connectorSelect = screen.getByTestId("connector-select");
    await user.selectOptions(connectorSelect, "or");
    expect(mockCallbacks.onToggleGroupConnector).toHaveBeenCalledWith("root");
  });
});
