import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { SingleSelect, type SingleSelectOption, type SingleSelectProps } from "./single-select";

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

type StoryProps = SingleSelectProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/SingleSelect",
  component: SingleSelect,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete single-select question element that combines headline, description, and radio button options. Supports single selection, validation, and RTL text direction.",
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
    headline: "This question is disabled",
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

export const MultipleQuestions: Story = {
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
