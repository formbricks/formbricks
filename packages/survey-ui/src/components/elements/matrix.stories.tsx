import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  type InputLayoutStylingOptions,
  type LabelStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  inputStylingArgTypes,
  labelStylingArgTypes,
  pickArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { Matrix, type MatrixOption, type MatrixProps } from "./matrix";

type StoryProps = MatrixProps &
  Partial<BaseStylingOptions & LabelStylingOptions & InputLayoutStylingOptions> &
  Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Matrix",
  component: Matrix,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete matrix element that combines headline, description, and a table with rows and columns. Each row can have one selected column value. Supports validation and RTL text direction.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
    rows: {
      control: "object",
      description: "Array of row options (left side)",
      table: { category: "Content" },
    },
    columns: {
      control: "object",
      description: "Array of column options (top header)",
      table: { category: "Content" },
    },
    value: {
      control: "object",
      description: "Record mapping row ID to column ID",
      table: { category: "State" },
    },
  },
  render: createStatefulRender(Matrix),
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args

const defaultRows: MatrixOption[] = [
  { id: "row-1", label: "Row 1" },
  { id: "row-2", label: "Row 2" },
  { id: "row-3", label: "Row 3" },
];

const defaultColumns: MatrixOption[] = [
  { id: "col-1", label: "Column 1" },
  { id: "col-2", label: "Column 2" },
  { id: "col-3", label: "Column 3" },
  { id: "col-4", label: "Column 4" },
];

export const StylingPlayground: Story = {
  args: {
    headline: "Rate each item",
    description: "Select a value for each row",
    rows: defaultRows,
    columns: defaultColumns,
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...labelStylingArgTypes,
    ...pickArgTypes(inputStylingArgTypes, ["inputBgColor", "inputBorderColor"]),
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};

export const Default: Story = {
  args: {
    elementId: "matrix-default",
    inputId: "matrix-default-input",
    headline: "Rate each item",
    rows: defaultRows,
    columns: defaultColumns,
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "matrix-with-description",
    inputId: "matrix-with-description-input",
    headline: "How satisfied are you with each feature?",
    description: "Please rate each feature on a scale from 1 to 5",
    rows: [
      { id: "feature-1", label: "Feature 1" },
      { id: "feature-2", label: "Feature 2" },
      { id: "feature-3", label: "Feature 3" },
    ],
    columns: [
      { id: "1", label: "1" },
      { id: "2", label: "2" },
      { id: "3", label: "3" },
      { id: "4", label: "4" },
      { id: "5", label: "5" },
    ],
  },
};

export const Required: Story = {
  args: {
    elementId: "matrix-required",
    inputId: "matrix-required-input",
    headline: "Rate each item",
    description: "Please select a value for each row",
    rows: defaultRows,
    columns: defaultColumns,
    required: true,
  },
};

export const WithSelections: Story = {
  args: {
    elementId: "matrix-selections",
    inputId: "matrix-selections-input",
    headline: "Rate each item",
    description: "Select a value for each row",
    rows: defaultRows,
    columns: defaultColumns,
    value: {
      "row-1": "col-2",
      "row-2": "col-3",
    },
  },
};

export const WithError: Story = {
  args: {
    elementId: "matrix-error",
    inputId: "matrix-error-input",
    headline: "Rate each item",
    description: "Please select a value for each row",
    rows: defaultRows,
    columns: defaultColumns,
    errorMessage: "Please complete all rows",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    elementId: "matrix-disabled",
    inputId: "matrix-disabled-input",
    headline: "This element is disabled",
    description: "You cannot change the selection",
    rows: defaultRows,
    columns: defaultColumns,
    value: {
      "row-1": "col-2",
      "row-2": "col-3",
    },
    disabled: true,
  },
};

export const RatingScale: Story = {
  args: {
    elementId: "matrix-rating-scale",
    inputId: "matrix-rating-scale-input",
    headline: "Rate your experience",
    description: "How would you rate each aspect?",
    rows: [
      { id: "quality", label: "Quality" },
      { id: "service", label: "Service" },
      { id: "value", label: "Value for Money" },
      { id: "support", label: "Customer Support" },
    ],
    columns: [
      { id: "poor", label: "Poor" },
      { id: "fair", label: "Fair" },
      { id: "good", label: "Good" },
      { id: "very-good", label: "Very Good" },
      { id: "excellent", label: "Excellent" },
    ],
  },
};

export const NumericScale: Story = {
  args: {
    elementId: "matrix-numeric-scale",
    inputId: "matrix-numeric-scale-input",
    headline: "Rate from 0 to 10",
    description: "Select a number for each item",
    rows: [
      { id: "item-1", label: "Item 1" },
      { id: "item-2", label: "Item 2" },
      { id: "item-3", label: "Item 3" },
    ],
    columns: [
      { id: "0", label: "0" },
      { id: "1", label: "1" },
      { id: "2", label: "2" },
      { id: "3", label: "3" },
      { id: "4", label: "4" },
      { id: "5", label: "5" },
      { id: "6", label: "6" },
      { id: "7", label: "7" },
      { id: "8", label: "8" },
      { id: "9", label: "9" },
      { id: "10", label: "10" },
    ],
  },
};

export const RTL: Story = {
  args: {
    elementId: "matrix-rtl",
    inputId: "matrix-rtl-input",
    headline: "قيم كل عنصر",
    description: "اختر قيمة لكل صف",
    dir: "rtl",
    rows: [
      { id: "row-1", label: "الصف الأول" },
      { id: "row-2", label: "الصف الثاني" },
      { id: "row-3", label: "الصف الثالث" },
    ],
    columns: [
      { id: "col-1", label: "عمود 1" },
      { id: "col-2", label: "عمود 2" },
      { id: "col-3", label: "عمود 3" },
      { id: "col-4", label: "عمود 4" },
    ],
  },
};

export const RTLWithSelections: Story = {
  args: {
    elementId: "matrix-rtl-selections",
    inputId: "matrix-rtl-selections-input",
    dir: "rtl",
    headline: "قيم كل عنصر",
    description: "يرجى اختيار قيمة لكل صف",
    rows: [
      { id: "quality", label: "الجودة" },
      { id: "service", label: "الخدمة" },
      { id: "value", label: "القيمة" },
    ],
    columns: [
      { id: "poor", label: "ضعيف" },
      { id: "fair", label: "مقبول" },
      { id: "good", label: "جيد" },
      { id: "very-good", label: "جيد جداً" },
      { id: "excellent", label: "ممتاز" },
    ],
    value: {
      quality: "good",
      service: "very-good",
    },
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <Matrix
        elementId="matrix-1"
        inputId="matrix-1-input"
        headline="Rate each item"
        description="Select a value for each row"
        rows={defaultRows}
        columns={defaultColumns}
        onChange={() => {}}
      />
      <Matrix
        elementId="matrix-2"
        inputId="matrix-2-input"
        headline="How satisfied are you?"
        rows={[
          { id: "feature-1", label: "Feature 1" },
          { id: "feature-2", label: "Feature 2" },
        ]}
        columns={[
          { id: "1", label: "1" },
          { id: "2", label: "2" },
          { id: "3", label: "3" },
          { id: "4", label: "4" },
          { id: "5", label: "5" },
        ]}
        value={{
          "feature-1": "4",
          "feature-2": "5",
        }}
        onChange={() => {}}
      />
    </div>
  ),
};
