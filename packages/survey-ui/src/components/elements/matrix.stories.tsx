import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Matrix, type MatrixOption, type MatrixProps } from "./matrix";

// Styling options for the StylingPlayground story
interface StylingOptions {
  // Question styling
  questionHeadlineFontFamily: string;
  questionHeadlineFontSize: string;
  questionHeadlineFontWeight: string;
  questionHeadlineColor: string;
  questionDescriptionFontFamily: string;
  questionDescriptionFontWeight: string;
  questionDescriptionFontSize: string;
  questionDescriptionColor: string;
  // Option label styling
  optionLabelFontFamily: string;
  optionLabelFontSize: string;
  optionLabelFontWeight: string;
  optionLabelColor: string;
  // Input styling
  inputBorderColor: string;
  inputBgColor: string;
  inputColor: string;
}

type StoryProps = MatrixProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Matrix",
  component: Matrix,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete matrix question element that combines headline, description, and a table with rows and columns. Each row can have one selected column value. Supports validation and RTL text direction.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    headline: {
      control: "text",
      description: "The main question text",
      table: { category: "Content" },
    },
    description: {
      control: "text",
      description: "Optional description or subheader text",
      table: { category: "Content" },
    },
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
    required: {
      control: "boolean",
      description: "Whether the field is required",
      table: { category: "Validation" },
    },
    errorMessage: {
      control: "text",
      description: "Error message to display",
      table: { category: "Validation" },
    },
    dir: {
      control: { type: "select" },
      options: ["ltr", "rtl", "auto"],
      description: "Text direction for RTL support",
      table: { category: "Layout" },
    },
    disabled: {
      control: "boolean",
      description: "Whether the options are disabled",
      table: { category: "State" },
    },
    onChange: {
      action: "changed",
      table: { category: "Events" },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const {
    questionHeadlineFontFamily,
    questionHeadlineFontSize,
    questionHeadlineFontWeight,
    questionHeadlineColor,
    questionDescriptionFontFamily,
    questionDescriptionFontSize,
    questionDescriptionFontWeight,
    questionDescriptionColor,
    optionLabelFontFamily,
    optionLabelFontSize,
    optionLabelFontWeight,
    optionLabelColor,
    inputBorderColor,
    inputBgColor,
    inputColor,
  } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-question-headline-font-family": questionHeadlineFontFamily,
    "--fb-question-headline-font-size": questionHeadlineFontSize,
    "--fb-question-headline-font-weight": questionHeadlineFontWeight,
    "--fb-question-headline-color": questionHeadlineColor,
    "--fb-question-description-font-family": questionDescriptionFontFamily,
    "--fb-question-description-font-size": questionDescriptionFontSize,
    "--fb-question-description-font-weight": questionDescriptionFontWeight,
    "--fb-question-description-color": questionDescriptionColor,
    "--fb-option-label-font-family": optionLabelFontFamily,
    "--fb-option-label-font-size": optionLabelFontSize,
    "--fb-option-label-font-weight": optionLabelFontWeight,
    "--fb-option-label-color": optionLabelColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-color": inputColor,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

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
    // Question styling
    questionHeadlineFontFamily: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionHeadlineFontSize: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionHeadlineFontWeight: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionHeadlineColor: {
      control: "color",
      table: { category: "Question Styling" },
    },
    questionDescriptionFontFamily: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionDescriptionFontSize: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionDescriptionFontWeight: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionDescriptionColor: {
      control: "color",
      table: { category: "Question Styling" },
    },
    // Option label styling
    optionLabelFontFamily: {
      control: "text",
      table: { category: "Option Label Styling" },
    },
    optionLabelFontSize: {
      control: "text",
      table: { category: "Option Label Styling" },
    },
    optionLabelFontWeight: {
      control: "text",
      table: { category: "Option Label Styling" },
    },
    optionLabelColor: {
      control: "color",
      table: { category: "Option Label Styling" },
    },
    // Input styling
    inputBorderColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputBgColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    headline: "Rate each item",
    rows: defaultRows,
    columns: defaultColumns,
  },
};

export const WithDescription: Story = {
  args: {
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
    headline: "Rate each item",
    description: "Please select a value for each row",
    rows: defaultRows,
    columns: defaultColumns,
    required: true,
  },
};

export const WithSelections: Story = {
  args: {
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
    headline: "This question is disabled",
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
    headline: "قيم كل عنصر",
    description: "اختر قيمة لكل صف",
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

export const MultipleQuestions: Story = {
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
