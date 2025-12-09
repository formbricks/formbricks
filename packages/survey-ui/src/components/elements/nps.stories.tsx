import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { NPS, type NPSProps } from "./nps";

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
  // Label styling
  labelFontFamily: string;
  labelFontSize: string;
  labelFontWeight: string;
  labelColor: string;
  labelOpacity: string;
}

type StoryProps = NPSProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/NPS",
  component: NPS,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A Net Promoter Score (NPS) element. Users can select a rating from 0 to 10 to indicate how likely they are to recommend something.",
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
    value: {
      control: { type: "number", min: 0, max: 10 },
      description: "Currently selected NPS value (0-10)",
      table: { category: "State" },
    },
    lowerLabel: {
      control: "text",
      description: "Label for the lower end of the scale",
      table: { category: "Content" },
    },
    upperLabel: {
      control: "text",
      description: "Label for the upper end of the scale",
      table: { category: "Content" },
    },
    colorCoding: {
      control: "boolean",
      description: "Whether color coding is enabled",
      table: { category: "Content" },
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
      description: "Whether the controls are disabled",
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
      <NPS
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
    elementHeadlineFontFamily,
    elementHeadlineFontSize,
    elementHeadlineFontWeight,
    elementHeadlineColor,
    elementDescriptionFontFamily,
    elementDescriptionFontSize,
    elementDescriptionFontWeight,
    elementDescriptionColor,
    labelFontFamily,
    labelFontSize,
    labelFontWeight,
    labelColor,
    labelOpacity,
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
    "--fb-label-font-family": labelFontFamily,
    "--fb-label-font-size": labelFontSize,
    "--fb-label-font-weight": labelFontWeight,
    "--fb-label-color": labelColor,
    "--fb-label-opacity": labelOpacity,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    elementId: "nps-1",
    inputId: "nps-input-1",
    headline: "How likely are you to recommend us to a friend or colleague?",
    description: "Please rate from 0 to 10",
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
    elementHeadlineFontFamily: "system-ui, sans-serif",
    elementHeadlineFontSize: "1.125rem",
    elementHeadlineFontWeight: "600",
    elementHeadlineColor: "#1e293b",
    elementDescriptionFontFamily: "system-ui, sans-serif",
    elementDescriptionFontSize: "0.875rem",
    elementDescriptionFontWeight: "400",
    elementDescriptionColor: "#64748b",
    labelFontFamily: "system-ui, sans-serif",
    labelFontSize: "0.75rem",
    labelFontWeight: "400",
    labelColor: "#64748b",
    labelOpacity: "1",
  },
  argTypes: {
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
    labelFontFamily: {
      control: "text",
      table: { category: "Label Styling" },
    },
    labelFontSize: {
      control: "text",
      table: { category: "Label Styling" },
    },
    labelFontWeight: {
      control: "text",
      table: { category: "Label Styling" },
    },
    labelColor: {
      control: "color",
      table: { category: "Label Styling" },
    },
    labelOpacity: {
      control: "text",
      table: { category: "Label Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    elementId: "nps-1",
    inputId: "nps-input-1",
    headline: "How likely are you to recommend us to a friend or colleague?",
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "nps-2",
    inputId: "nps-input-2",
    headline: "How likely are you to recommend us to a friend or colleague?",
    description: "Please rate from 0 to 10, where 0 is not at all likely and 10 is extremely likely",
  },
};

export const WithLabels: Story = {
  args: {
    elementId: "nps-labels",
    inputId: "nps-input-labels",
    headline: "How likely are you to recommend us to a friend or colleague?",
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const WithSelection: Story = {
  args: {
    elementId: "nps-selection",
    inputId: "nps-input-selection",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 9,
  },
};

export const Required: Story = {
  args: {
    elementId: "nps-required",
    inputId: "nps-input-required",
    headline: "How likely are you to recommend us to a friend or colleague?",
    required: true,
  },
};

export const WithError: Story = {
  args: {
    elementId: "nps-error",
    inputId: "nps-input-error",
    headline: "How likely are you to recommend us to a friend or colleague?",
    required: true,
    errorMessage: "Please select a rating",
  },
};

export const Disabled: Story = {
  args: {
    elementId: "nps-disabled",
    inputId: "nps-input-disabled",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 8,
    disabled: true,
  },
};

export const ColorCoding: Story = {
  args: {
    elementId: "nps-color",
    inputId: "nps-input-color",
    headline: "How likely are you to recommend us to a friend or colleague?",
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const Promoter: Story = {
  args: {
    elementId: "nps-promoter",
    inputId: "nps-input-promoter",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 9,
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const Passive: Story = {
  args: {
    elementId: "nps-passive",
    inputId: "nps-input-passive",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 7,
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const Detractor: Story = {
  args: {
    elementId: "nps-detractor",
    inputId: "nps-input-detractor",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 5,
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const RTL: Story = {
  args: {
    elementId: "nps-rtl",
    inputId: "nps-input-rtl",
    headline: "ما مدى احتمالية أن توصي بنا لصديق أو زميل؟",
    description: "يرجى التقييم من 0 إلى 10",
    lowerLabel: "غير محتمل على الإطلاق",
    upperLabel: "محتمل للغاية",
  },
};

export const RTLWithSelection: Story = {
  args: {
    elementId: "nps-rtl-selection",
    inputId: "nps-input-rtl-selection",
    headline: "ما مدى احتمالية أن توصي بنا لصديق أو زميل؟",
    value: 8,
    lowerLabel: "غير محتمل على الإطلاق",
    upperLabel: "محتمل للغاية",
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <NPS
        elementId="nps-1"
        inputId="nps-input-1"
        headline="How likely are you to recommend our product?"
        lowerLabel="Not at all likely"
        upperLabel="Extremely likely"
        onChange={() => {}}
      />
      <NPS
        elementId="nps-2"
        inputId="nps-input-2"
        headline="How likely are you to recommend our service?"
        description="Please rate from 0 to 10"
        value={9}
        colorCoding
        lowerLabel="Not at all likely"
        upperLabel="Extremely likely"
        onChange={() => {}}
      />
    </div>
  ),
};
