import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { useEffect, useState } from "react";
import {
  type BaseStylingOptions,
  type LabelStylingOptions,
  type OptionStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  elementStylingArgTypes,
  inputStylingArgTypes,
  labelStylingArgTypes,
  optionStylingArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { SingleSelect, type SingleSelectOption, type SingleSelectProps } from "./single-select";

type StoryProps = SingleSelectProps &
  Partial<BaseStylingOptions & LabelStylingOptions & OptionStylingOptions> &
  Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/SingleSelect",
  component: SingleSelect,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete single-select element that combines headline, description, and radio button options. Supports single selection, validation, and RTL text direction.",
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
      control: "text",
      description: "Selected option ID",
      table: { category: "State" },
    },
    variant: {
      control: { type: "select" },
      options: ["list", "dropdown"],
      description: "Display variant: 'list' shows radio buttons, 'dropdown' shows a dropdown menu",
      table: { category: "Layout" },
    },
    placeholder: {
      control: "text",
      description: "Placeholder text for dropdown button when no option is selected",
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
      <SingleSelect
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

const defaultOptions: SingleSelectOption[] = [
  { id: "option-1", label: "Option 1" },
  { id: "option-2", label: "Option 2" },
  { id: "option-3", label: "Option 3" },
  { id: "option-4", label: "Option 4" },
];

export const StylingPlayground: Story = {
  args: {
    headline: "Which option do you prefer?",
    description: "Select one option",
    options: defaultOptions,
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...labelStylingArgTypes,
    ...optionStylingArgTypes,
    ...inputStylingArgTypes,
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};

export const Default: Story = {
  args: {
    headline: "Which option do you prefer?",
    options: defaultOptions,
  },
};

export const WithDescription: Story = {
  args: {
    headline: "What is your favorite programming language?",
    description: "Select the language you use most frequently",
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
    headline: "Select your preferred plan",
    description: "Please choose one option",
    options: [
      { id: "basic", label: "Basic Plan" },
      { id: "pro", label: "Pro Plan" },
      { id: "enterprise", label: "Enterprise Plan" },
    ],
    required: true,
  },
};

export const WithSelection: Story = {
  args: {
    headline: "Which option do you prefer?",
    description: "Select one option",
    options: defaultOptions,
    value: "option-2",
  },
};

export const WithError: Story = {
  args: {
    headline: "Select your preference",
    description: "Please select an option",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
      { id: "maybe", label: "Maybe" },
    ],
    errorMessage: "Please select an option",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    headline: "This element is disabled",
    description: "You cannot change the selection",
    options: defaultOptions,
    value: "option-2",
    disabled: true,
  },
};

export const RTL: Story = {
  args: {
    headline: "ما هو خيارك المفضل؟",
    dir: "rtl",
    description: "اختر خيارًا واحدًا",
    options: [
      { id: "opt-1", label: "الخيار الأول" },
      { id: "opt-2", label: "الخيار الثاني" },
      { id: "opt-3", label: "الخيار الثالث" },
      { id: "opt-4", label: "الخيار الرابع" },
    ],
  },
};

export const RTLWithSelection: Story = {
  args: {
    headline: "ما هو تفضيلك؟",
    dir: "rtl",
    description: "يرجى اختيار خيار واحد",
    options: [
      { id: "tech", label: "التكنولوجيا" },
      { id: "design", label: "التصميم" },
      { id: "marketing", label: "التسويق" },
      { id: "sales", label: "المبيعات" },
    ],
    value: "tech",
  },
};

export const MultipleElements: Story = {
  render: () => {
    const [value1, setValue1] = React.useState<string | undefined>(undefined);
    const [value2, setValue2] = React.useState<string>("js");

    return (
      <div className="w-[600px] space-y-8">
        <SingleSelect
          elementId="preference"
          inputId="preference-input"
          headline="Which option do you prefer?"
          description="Select one option"
          options={defaultOptions}
          value={value1}
          onChange={setValue1}
        />
        <SingleSelect
          elementId="language"
          inputId="language-input"
          headline="What is your favorite programming language?"
          options={[
            { id: "js", label: "JavaScript" },
            { id: "ts", label: "TypeScript" },
            { id: "python", label: "Python" },
          ]}
          value={value2}
          onChange={setValue2}
        />
      </div>
    );
  },
};

export const Dropdown: Story = {
  args: {
    headline: "Which option do you prefer?",
    description: "Select one option",
    options: defaultOptions,
    variant: "dropdown",
    placeholder: "Choose an option...",
  },
};

export const DropdownWithSelection: Story = {
  args: {
    headline: "Which option do you prefer?",
    description: "Select one option",
    options: defaultOptions,
    value: "option-2",
    variant: "dropdown",
    placeholder: "Choose an option...",
  },
};

export const WithOtherOption: Story = {
  render: () => {
    const [value, setValue] = React.useState<string | undefined>(undefined);
    const [otherValue, setOtherValue] = React.useState<string>("");

    return (
      <div className="w-[600px]">
        <SingleSelect
          elementId="single-select-other"
          inputId="single-select-other-input"
          headline="Which option do you prefer?"
          description="Select one option"
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
    const [value, setValue] = React.useState<string>("other");
    const [otherValue, setOtherValue] = React.useState<string>("Custom option");

    return (
      <div className="w-[600px]">
        <SingleSelect
          elementId="single-select-other-selected"
          inputId="single-select-other-selected-input"
          headline="Which option do you prefer?"
          description="Select one option"
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
    const [value, setValue] = React.useState<string | undefined>(undefined);
    const [otherValue, setOtherValue] = React.useState<string>("");

    return (
      <div className="w-[600px]">
        <SingleSelect
          elementId="single-select-dropdown-other"
          inputId="single-select-dropdown-other-input"
          headline="Which option do you prefer?"
          description="Select one option"
          options={defaultOptions}
          value={value}
          onChange={setValue}
          variant="dropdown"
          placeholder="Choose an option..."
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

export const WithContainerStyling: Story = {
  args: {
    headline: "Select your preferred option",
    description: "Each option has a container with custom styling",
    options: [
      { id: "option-1", label: "Option 1" },
      { id: "option-2", label: "Option 2" },
      { id: "option-3", label: "Option 3" },
      { id: "option-4", label: "Option 4" },
    ],
    value: "option-2",
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};

export const WithContainerStylingAndOther: Story = {
  render: () => {
    const [value, setValue] = React.useState<string | undefined>(undefined);
    const [otherValue, setOtherValue] = React.useState<string>("");

    return (
      <div className="w-[600px]">
        <SingleSelect
          elementId="container-styling-other"
          inputId="container-styling-other-input"
          headline="Select an option"
          description="Options have containers, including the 'Other' option"
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
