import type { Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import {
  type BaseStylingOptions,
  type CheckboxInputStylingOptions,
  type LabelStylingOptions,
  type OptionStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  elementStylingArgTypes,
  labelStylingArgTypes,
  optionStylingArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { MultiSelect, type MultiSelectOption, type MultiSelectProps } from "./multi-select";

type StoryProps = MultiSelectProps &
  Partial<BaseStylingOptions & LabelStylingOptions & OptionStylingOptions & CheckboxInputStylingOptions> &
  Record<string, unknown>;

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
    ...commonArgTypes,
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
  },
  render: function Render(args: StoryProps) {
    const [value, setValue] = useState(args.value);
    const [otherValue, setOtherValue] = useState(args.otherValue);
    const handleOtherValueChange = (v: string) => {
      setOtherValue(v);
      args.onOtherValueChange?.(v);
    };

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
        otherValue={otherValue}
        onOtherValueChange={handleOtherValueChange}
      />
    );
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

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
    ...elementStylingArgTypes,
    ...labelStylingArgTypes,
    ...optionStylingArgTypes,
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
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
    dir: "rtl",
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
    dir: "rtl",
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
