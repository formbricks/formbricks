import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { SingleSelect, type SingleSelectOption, type SingleSelectProps } from "./single-select";

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
  // Input styling
  inputBorderColor: string;
  inputBgColor: string;
  inputColor: string;
}

type StoryProps = SingleSelectProps & Partial<StylingOptions>;

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
      control: "text",
      description: "Selected option ID",
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
      description: "Display variant: 'list' shows radio buttons, 'dropdown' shows a dropdown menu",
      table: { category: "Layout" },
    },
    placeholder: {
      control: "text",
      description: "Placeholder text for dropdown button when no option is selected",
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
      <SingleSelect
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
    inputBorderColor,
    inputBgColor,
    inputColor,
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
  render: () => (
    <div className="w-[600px] space-y-8">
      <SingleSelect
        elementId="preference"
        inputId="preference-input"
        headline="Which option do you prefer?"
        description="Select one option"
        options={defaultOptions}
        onChange={() => {}}
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
        value="js"
        onChange={() => {}}
      />
    </div>
  ),
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
