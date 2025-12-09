import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { MultiSelect, type MultiSelectOption, type MultiSelectProps } from "./multi-select";

// Styling options for the StylingPlayground story
interface StylingOptions {
  // Element styling
  elementHeadlineFontFamily: string;
  elementHeadlineFontSize: string;
  elementHeadlineFontWeight: string;
  elementHeadlineColor: string;
  elementDescriptionFontFamily: string;
  elementDescriptionFontWeight: string;
  elementDescriptionFontSize: string;
  elementDescriptionColor: string;
  // Option label styling
  optionLabelFontFamily: string;
  optionLabelFontSize: string;
  optionLabelFontWeight: string;
  optionLabelColor: string;
  // Checkbox Input styling
  checkboxInputBorderColor: string;
  checkboxInputBgColor: string;
  checkboxInputColor: string;
}

type StoryProps = MultiSelectProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/MultiSelect",
  component: MultiSelect,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete multi-select element that combines headline, description, and checkbox options. Supports multiple selections, validation, and RTL text direction.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    headline: {
      control: "text",
      description: "The main element text",
      table: { category: "Content" },
    },
    description: {
      control: "text",
      description: "Optional description or subheader text",
      table: { category: "Content" },
    },
    options: {
      control: "object",
      description: "Array of options to choose from",
      table: { category: "Content" },
    },
    value: {
      control: "object",
      description: "Array of selected option IDs",
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
    variant: {
      control: { type: "select" },
      options: ["list", "dropdown"],
      description: "Display variant: 'list' shows checkboxes, 'dropdown' shows a dropdown menu",
      table: { category: "Layout" },
    },
    placeholder: {
      control: "text",
      description: "Placeholder text for dropdown button when no options are selected",
      table: { category: "Content" },
    },
    onChange: {
      action: "changed",
      table: { category: "Events" },
    },
  },
  render: function Render(args: StoryProps) {
    const [value, setValue] = useState(args.value);

    useEffect(() => {
      setValue(args.value);
    }, [args.value]);

    return (
      <MultiSelect
        {...args}
        value={value}
        onChange={(v) => {
          setValue(v);
          args.onChange?.(v);
        }}
      />
    );
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const {
    elementHeadlineFontFamily,
    elementHeadlineFontSize,
    elementHeadlineFontWeight,
    elementHeadlineColor,
    elementDescriptionFontFamily,
    elementDescriptionFontSize,
    elementDescriptionFontWeight,
    elementDescriptionColor,
    optionLabelFontFamily,
    optionLabelFontSize,
    optionLabelFontWeight,
    optionLabelColor,
    checkboxInputBorderColor,
    checkboxInputBgColor,
    checkboxInputColor,
  } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-element-headline-font-family": elementHeadlineFontFamily,
    "--fb-element-headline-font-size": elementHeadlineFontSize,
    "--fb-element-headline-font-weight": elementHeadlineFontWeight,
    "--fb-element-headline-color": elementHeadlineColor,
    "--fb-element-description-font-family": elementDescriptionFontFamily,
    "--fb-element-description-font-size": elementDescriptionFontSize,
    "--fb-element-description-font-weight": elementDescriptionFontWeight,
    "--fb-element-description-color": elementDescriptionColor,
    "--fb-option-label-font-family": optionLabelFontFamily,
    "--fb-option-label-font-size": optionLabelFontSize,
    "--fb-option-label-font-weight": optionLabelFontWeight,
    "--fb-option-label-color": optionLabelColor,
    "--fb-input-border-color": checkboxInputBorderColor,
    "--fb-input-bg-color": checkboxInputBgColor,
    "--fb-input-color": checkboxInputColor,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

const defaultOptions: MultiSelectOption[] = [
  { id: "option-1", label: "Option 1" },
  { id: "option-2", label: "Option 2" },
  { id: "option-3", label: "Option 3" },
  { id: "option-4", label: "Option 4" },
];

export const StylingPlayground: Story = {
  args: {
    headline: "Which features do you use?",
    description: "Select all that apply",
    options: defaultOptions,
  },
  argTypes: {
    // Element styling
    elementHeadlineFontFamily: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementHeadlineFontSize: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementHeadlineFontWeight: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementHeadlineColor: {
      control: "color",
      table: { category: "Element Styling" },
    },
    elementDescriptionFontFamily: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementDescriptionFontSize: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementDescriptionFontWeight: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementDescriptionColor: {
      control: "color",
      table: { category: "Element Styling" },
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
    // Checkbox Input styling
    checkboxInputBorderColor: {
      control: "color",
      table: { category: "Checkbox Input Styling" },
    },
    checkboxInputBgColor: {
      control: "color",
      table: { category: "Checkbox Input Styling" },
    },
    checkboxInputColor: {
      control: "color",
      table: { category: "Checkbox Input Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    headline: "Which features do you use?",
    options: defaultOptions,
  },
};

export const WithDescription: Story = {
  args: {
    headline: "What programming languages do you know?",
    description: "Select all programming languages you're familiar with",
    options: [
      { id: "js", label: "JavaScript" },
      { id: "ts", label: "TypeScript" },
      { id: "python", label: "Python" },
      { id: "java", label: "Java" },
      { id: "go", label: "Go" },
      { id: "rust", label: "Rust" },
    ],
  },
};

export const Required: Story = {
  args: {
    headline: "Select your interests",
    description: "Please select at least one option",
    options: [
      { id: "tech", label: "Technology" },
      { id: "design", label: "Design" },
      { id: "marketing", label: "Marketing" },
      { id: "sales", label: "Sales" },
    ],
    required: true,
  },
};

export const WithSelections: Story = {
  args: {
    headline: "Which features do you use?",
    description: "Select all that apply",
    options: defaultOptions,
    value: ["option-1", "option-3"],
  },
};

export const WithError: Story = {
  args: {
    headline: "Select your preferences",
    description: "Please select at least one option",
    options: [
      { id: "email", label: "Email notifications" },
      { id: "sms", label: "SMS notifications" },
      { id: "push", label: "Push notifications" },
    ],
    errorMessage: "Please select at least one option",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    headline: "This element is disabled",
    description: "You cannot change the selection",
    options: defaultOptions,
    value: ["option-2"],
    disabled: true,
  },
};

export const ManyOptions: Story = {
  args: {
    headline: "Select all that apply",
    description: "Choose as many as you like",
    options: [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
      { id: "3", label: "Option 3" },
      { id: "4", label: "Option 4" },
      { id: "5", label: "Option 5" },
      { id: "6", label: "Option 6" },
      { id: "7", label: "Option 7" },
      { id: "8", label: "Option 8" },
      { id: "9", label: "Option 9" },
      { id: "10", label: "Option 10" },
    ],
  },
};

export const RTL: Story = {
  args: {
    headline: "ما هي الميزات التي تستخدمها؟",
    description: "اختر كل ما ينطبق",
    options: [
      { id: "opt-1", label: "الخيار الأول" },
      { id: "opt-2", label: "الخيار الثاني" },
      { id: "opt-3", label: "الخيار الثالث" },
      { id: "opt-4", label: "الخيار الرابع" },
    ],
  },
};

export const RTLWithSelections: Story = {
  args: {
    headline: "ما هي اهتماماتك؟",
    description: "يرجى اختيار جميع الخيارات المناسبة",
    options: [
      { id: "tech", label: "التكنولوجيا" },
      { id: "design", label: "التصميم" },
      { id: "marketing", label: "التسويق" },
      { id: "sales", label: "المبيعات" },
    ],
    value: ["tech", "design"],
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <MultiSelect
        elementId="features"
        inputId="features-input"
        headline="Which features do you use?"
        description="Select all that apply"
        options={defaultOptions}
        onChange={() => {}}
      />
      <MultiSelect
        elementId="languages"
        inputId="languages-input"
        headline="What programming languages do you know?"
        options={[
          { id: "js", label: "JavaScript" },
          { id: "ts", label: "TypeScript" },
          { id: "python", label: "Python" },
        ]}
        value={["js", "ts"]}
        onChange={() => {}}
      />
    </div>
  ),
};

export const Dropdown: Story = {
  args: {
    headline: "Which features do you use?",
    description: "Select all that apply",
    options: defaultOptions,
    variant: "dropdown",
    placeholder: "Select options...",
  },
};

export const DropdownWithSelections: Story = {
  args: {
    headline: "Which features do you use?",
    description: "Select all that apply",
    options: defaultOptions,
    value: ["option-1", "option-3"],
    variant: "dropdown",
    placeholder: "Select options...",
  },
};

export const WithOtherOption: Story = {
  render: () => {
    const [value, setValue] = React.useState<string[]>([]);
    const [otherValue, setOtherValue] = React.useState<string>("");

    return (
      <div className="w-[600px]">
        <MultiSelect
          elementId="multi-select-other"
          inputId="multi-select-other-input"
          headline="Which features do you use?"
          description="Select all that apply"
          options={defaultOptions}
          value={value}
          onChange={setValue}
          otherOptionId="other"
          otherOptionLabel="Other"
          otherOptionPlaceholder="Please specify"
          otherValue={otherValue}
          onOtherValueChange={setOtherValue}
        />
      </div>
    );
  },
};

export const WithOtherOptionSelected: Story = {
  render: () => {
    const [value, setValue] = React.useState<string[]>(["option-1", "other"]);
    const [otherValue, setOtherValue] = React.useState<string>("Custom feature");

    return (
      <div className="w-[600px]">
        <MultiSelect
          elementId="multi-select-other-selected"
          inputId="multi-select-other-selected-input"
          headline="Which features do you use?"
          description="Select all that apply"
          options={defaultOptions}
          value={value}
          onChange={setValue}
          otherOptionId="other"
          otherOptionLabel="Other"
          otherOptionPlaceholder="Please specify"
          otherValue={otherValue}
          onOtherValueChange={setOtherValue}
        />
      </div>
    );
  },
};

export const DropdownWithOtherOption: Story = {
  render: () => {
    const [value, setValue] = React.useState<string[]>([]);
    const [otherValue, setOtherValue] = React.useState<string>("");

    return (
      <div className="w-[600px]">
        <MultiSelect
          elementId="multi-select-dropdown-other"
          inputId="multi-select-dropdown-other-input"
          headline="Which features do you use?"
          description="Select all that apply"
          options={defaultOptions}
          value={value}
          onChange={setValue}
          variant="dropdown"
          placeholder="Select options..."
          otherOptionId="other"
          otherOptionLabel="Other"
          otherOptionPlaceholder="Please specify"
          otherValue={otherValue}
          onOtherValueChange={setOtherValue}
        />
      </div>
    );
  },
};
