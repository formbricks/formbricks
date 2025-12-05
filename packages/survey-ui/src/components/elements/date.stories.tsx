import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { DateQuestion, type DateQuestionProps } from "./date";

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
  // Input styling
  inputWidth: string;
  inputHeight: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: string;
  inputFontSize: string;
  inputColor: string;
  inputPaddingX: string;
  inputPaddingY: string;
}

type StoryProps = DateQuestionProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Date",
  component: DateQuestion,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete date question element that combines headline, description, and a date input. Supports date range constraints, validation, and RTL text direction.",
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
    value: {
      control: "text",
      description: "Current date value in ISO format (YYYY-MM-DD)",
      table: { category: "State" },
    },
    minDate: {
      control: "text",
      description: "Minimum date allowed (ISO format: YYYY-MM-DD)",
      table: { category: "Validation" },
    },
    maxDate: {
      control: "text",
      description: "Maximum date allowed (ISO format: YYYY-MM-DD)",
      table: { category: "Validation" },
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
      description: "Whether the date input is disabled",
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
    inputWidth,
    inputHeight,
    inputBgColor,
    inputBorderColor,
    inputBorderRadius,
    inputFontSize,
    inputColor,
    inputPaddingX,
    inputPaddingY,
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
    "--fb-input-width": inputWidth,
    "--fb-input-height": inputHeight,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-border-radius": inputBorderRadius,
    "--fb-input-font-size": inputFontSize,
    "--fb-input-color": inputColor,
    "--fb-input-padding-x": inputPaddingX,
    "--fb-input-padding-y": inputPaddingY,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Please select a date",
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
    // Input styling
    inputWidth: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputHeight: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputBgColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputBorderColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputBorderRadius: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputFontSize: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputPaddingX: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputPaddingY: {
      control: "text",
      table: { category: "Input Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    headline: "What is your date of birth?",
  },
};

export const WithDescription: Story = {
  args: {
    headline: "When would you like to schedule the appointment?",
    description: "Please select a date for your appointment",
  },
};

export const Required: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Please select your date of birth",
    required: true,
  },
};

export const WithValue: Story = {
  args: {
    headline: "What is your date of birth?",
    value: "1990-01-15",
  },
};

export const WithDateRange: Story = {
  args: {
    headline: "Select a date for your event",
    description: "Please choose a date between today and next year",
    minDate: new Date().toISOString().split("T")[0],
    maxDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
  },
};

export const WithError: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Please select your date of birth",
    errorMessage: "Please select a valid date",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    headline: "This date field is disabled",
    description: "You cannot change the date",
    value: "2024-01-15",
    disabled: true,
  },
};

export const PastDatesOnly: Story = {
  args: {
    headline: "When did you start your current job?",
    description: "Select a date in the past",
    maxDate: new Date().toISOString().split("T")[0],
  },
};

export const FutureDatesOnly: Story = {
  args: {
    headline: "When would you like to schedule the meeting?",
    description: "Select a date in the future",
    minDate: new Date().toISOString().split("T")[0],
  },
};

export const RTL: Story = {
  args: {
    headline: "ما هو تاريخ ميلادك؟",
    description: "يرجى اختيار تاريخ",
  },
};

export const RTLWithValue: Story = {
  args: {
    headline: "ما هو تاريخ ميلادك؟",
    description: "يرجى اختيار تاريخ",
    value: "1990-01-15",
  },
};

export const MultipleQuestions: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <DateQuestion
        elementId="date-1"
        inputId="date-1-input"
        headline="What is your date of birth?"
        description="Please select your date of birth"
        onChange={() => {}}
      />
      <DateQuestion
        elementId="date-2"
        inputId="date-2-input"
        headline="When would you like to schedule the appointment?"
        value="2024-12-25"
        onChange={() => {}}
      />
    </div>
  ),
};
