import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { Consent, type ConsentProps } from "./consent";

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
}

type StoryProps = ConsentProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Consent",
  component: Consent,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A consent question element that displays a checkbox for users to accept terms, conditions, or agreements.",
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
    checkboxLabel: {
      control: "text",
      description: "Label text for the consent checkbox",
      table: { category: "Content" },
    },
    value: {
      control: "boolean",
      description: "Whether consent is checked",
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
      description: "Whether the checkbox is disabled",
      table: { category: "State" },
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
      <Consent
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
const withCSSVariables: Decorator<StoryProps> = (Story: any, context: any) => {
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
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    elementId: "consent-1",
    inputId: "consent-input-1",
    headline: "Terms and Conditions",
    description: "Please read and accept the terms",
    checkboxLabel: "I agree to the terms and conditions",
    questionHeadlineFontFamily: "system-ui, sans-serif",
    questionHeadlineFontSize: "1.125rem",
    questionHeadlineFontWeight: "600",
    questionHeadlineColor: "#1e293b",
    questionDescriptionFontFamily: "system-ui, sans-serif",
    questionDescriptionFontSize: "0.875rem",
    questionDescriptionFontWeight: "400",
    questionDescriptionColor: "#64748b",
    onChange: () => {},
  },
  argTypes: {
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
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    elementId: "consent-1",
    inputId: "consent-input-1",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    onChange: () => {},
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "consent-2",
    inputId: "consent-input-2",
    headline: "Terms and Conditions",
    description: "Please read and accept the terms to continue",
    checkboxLabel: "I agree to the terms and conditions",
    onChange: () => {},
  },
};

export const WithConsent: Story = {
  args: {
    elementId: "consent-3",
    inputId: "consent-input-3",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    value: true,
    onChange: () => {},
  },
};

export const Required: Story = {
  args: {
    elementId: "consent-4",
    inputId: "consent-input-4",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    required: true,
    onChange: () => {},
  },
};

export const WithError: Story = {
  args: {
    elementId: "consent-5",
    inputId: "consent-input-5",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    required: true,
    errorMessage: "You must accept the terms to continue",
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    elementId: "consent-6",
    inputId: "consent-input-6",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    value: true,
    disabled: true,
    onChange: () => {},
  },
};

export const RTL: Story = {
  args: {
    elementId: "consent-rtl",
    inputId: "consent-input-rtl",
    headline: "الشروط والأحكام",
    description: "يرجى قراءة الشروط والموافقة عليها",
    checkboxLabel: "أوافق على الشروط والأحكام",
    onChange: () => {},
  },
};

export const RTLWithConsent: Story = {
  args: {
    elementId: "consent-rtl-checked",
    inputId: "consent-input-rtl-checked",
    headline: "الشروط والأحكام",
    checkboxLabel: "أوافق على الشروط والأحكام",
    value: true,
    onChange: () => {},
  },
};

export const MultipleQuestions: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <Consent
        elementId="consent-1"
        inputId="consent-input-1"
        headline="Terms and Conditions"
        description="Please read and accept the terms"
        checkboxLabel="I agree to the terms and conditions"
        onChange={() => {}}
      />
      <Consent
        elementId="consent-2"
        inputId="consent-input-2"
        headline="Privacy Policy"
        description="Please review our privacy policy"
        checkboxLabel="I agree to the privacy policy"
        value
        onChange={() => {}}
      />
    </div>
  ),
};
