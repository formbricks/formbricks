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
  labelFontFamily: string;
  labelFontSize: string;
  labelFontWeight: string;
  labelColor: string;
  // Option styling
  optionBorderColor: string;
  optionBgColor: string;
  optionLabelColor: string;
  optionBorderRadius: string;
  optionPaddingX: string;
  optionPaddingY: string;
  optionFontFamily: string;
  optionFontSize: string;
  optionFontWeight: string;
  //input styling
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: string;
  inputPaddingX: string;
  inputPaddingY: string;
  inputFontFamily: string;
  inputFontSize: string;
  inputFontWeight: string;
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

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story: any, context: any) => {
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
    optionBorderColor,
    optionBgColor,
    optionLabelColor,
    optionBorderRadius,
    optionPaddingX,
    optionPaddingY,
    optionFontFamily,
    optionFontSize,
    optionFontWeight,
    inputBgColor,
    inputBorderColor,
    inputBorderRadius,
    inputPaddingX,
    inputPaddingY,
    inputFontFamily,
    inputFontSize,
    inputFontWeight,
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
    "--fb-option-border-color": optionBorderColor,
    "--fb-option-bg-color": optionBgColor,
    "--fb-option-label-color": optionLabelColor,
    "--fb-option-border-radius": optionBorderRadius,
    "--fb-option-padding-x": optionPaddingX,
    "--fb-option-padding-y": optionPaddingY,
    "--fb-option-font-family": optionFontFamily,
    "--fb-option-font-size": optionFontSize,
    "--fb-option-font-weight": optionFontWeight,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-border-radius": inputBorderRadius,
    "--fb-input-padding-x": inputPaddingX,
    "--fb-input-padding-y": inputPaddingY,
    "--fb-input-font-family": inputFontFamily,
    "--fb-input-font-size": inputFontSize,
    "--fb-input-font-weight": inputFontWeight,
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
    // Option styling
    optionBorderColor: {
      control: "color",
      description: "Border color for unselected options",
      table: { category: "Option Styling" },
    },
    optionBgColor: {
      control: "color",
      description: "Background color for unselected options",
      table: { category: "Option Styling" },
    },
    optionLabelColor: {
      control: "color",
      description: "Text/label color for options",
      table: { category: "Option Styling" },
    },
    optionBorderRadius: {
      control: "text",
      description: "Border radius for option containers",
      table: { category: "Option Styling" },
    },
    optionPaddingX: {
      control: "text",
      description: "Horizontal padding for option containers",
      table: { category: "Option Styling" },
    },
    optionPaddingY: {
      control: "text",
      description: "Vertical padding for option containers",
      table: { category: "Option Styling" },
    },
    optionFontFamily: {
      control: "text",
      description: "Font family for option labels",
      table: { category: "Option Styling" },
    },
    optionFontSize: {
      control: "text",
      description: "Font size for option labels",
      table: { category: "Option Styling" },
    },
    optionFontWeight: {
      control: "text",
      description: "Font weight for option labels",
      table: { category: "Option Styling" },
    },
    // input styling
    inputBgColor: {
      control: "color",
      description: "Background color for input",
      table: { category: "Input Styling" },
    },
    inputBorderColor: {
      control: "color",
      description: "Border color for input",
      table: { category: "Input Styling" },
    },
    inputBorderRadius: {
      control: "text",
      description: "Border radius for input",
      table: { category: "Input Styling" },
    },
    inputPaddingX: {
      control: "text",
      description: "Horizontal padding for input",
      table: { category: "Input Styling" },
    },
    inputPaddingY: {
      control: "text",
      description: "Vertical padding for input",
      table: { category: "Input Styling" },
    },
    inputFontFamily: {
      control: "text",
      description: "Font family for input",
      table: { category: "Input Styling" },
    },
    inputFontSize: {
      control: "text",
      description: "Font size for input",
      table: { category: "Input Styling" },
    },
    inputFontWeight: {
      control: "text",
      description: "Font weight for input",
      table: { category: "Input Styling" },
    },
    inputColor: {
      control: "color",
      description: "Text/label color for input",
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
  decorators: [withCSSVariables],
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
